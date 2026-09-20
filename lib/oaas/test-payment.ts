/**
 * Paiement TEST local pour missions OaaS.
 * N’est PAS un paiement Stripe. Visible comme TEST. Idempotent.
 * Désactivé en production sauf OAAS_ALLOW_TEST_PAYMENTS=1 explicite.
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { OutcomeServiceError, unlockMissionAfterPayment } from "@/lib/oaas/mission-service";
import { STRIPE_OAAS_STATUS } from "@/lib/oaas/agents";
import { destinationFor } from "@/lib/payments/clevone/accounts";
import { newPublicRef, newReceiptNumber, receiptFingerprint } from "@/lib/payments/clevone/references";

export function isOaasTestPaymentAllowed(): boolean {
  if (process.env.OAAS_ALLOW_TEST_PAYMENTS === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export function stripeOaasAdapterStatus() {
  return STRIPE_OAAS_STATUS;
}

export async function confirmTestOutcomePayment(
  db: PrismaClient,
  input: { missionId: string; userId: string; idempotencyKey: string },
) {
  if (!isOaasTestPaymentAllowed()) {
    throw new OutcomeServiceError(
      "Paiement TEST désactivé. Stripe OaaS = ADAPTER_NOT_CONFIGURED.",
      403,
      "TEST_DISABLED",
    );
  }
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(input.idempotencyKey)) {
    throw new OutcomeServiceError("Clé d’idempotence invalide.");
  }

  const existing = await db.paymentIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { receipt: true },
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new OutcomeServiceError("Clé d’idempotence déjà utilisée.", 409, "CONFLICT");
    }
    if (existing.status === "PAID" && existing.outcomeMissionId === input.missionId) {
      return {
        publicRef: existing.publicRef,
        status: "PAID" as const,
        reused: true as const,
        test: true as const,
        stripe: STRIPE_OAAS_STATUS,
        receiptNumber: existing.receipt?.publicNumber ?? null,
      };
    }
    throw new OutcomeServiceError("Clé d’idempotence déjà utilisée pour un autre état.", 409, "CONFLICT");
  }

  const mission = await db.outcomeMission.findUnique({
    where: { id: input.missionId },
    include: { contract: true, pack: true, costs: true },
  });
  if (!mission || mission.ownerId !== input.userId) {
    throw new OutcomeServiceError("Mission introuvable.", 404);
  }
  if (mission.status === "PLANNED" || mission.status === "READY" || mission.status === "EXECUTING") {
    return {
      publicRef: null,
      status: mission.status,
      reused: true as const,
      test: true as const,
      stripe: STRIPE_OAAS_STATUS,
      receiptNumber: null,
      unlocked: true as const,
    };
  }
  if (mission.status !== "AWAITING_PAYMENT" && mission.status !== "REVISION_REQUESTED") {
    throw new OutcomeServiceError("Cette mission n’attend pas de paiement.", 409, "CONFLICT");
  }
  if (!mission.contract || mission.contract.status !== "ACCEPTED") {
    throw new OutcomeServiceError("Le contrat doit être accepté avant paiement.", 409, "CONFLICT");
  }

  const deposit = mission.costs.find((c) => c.kind === "DEPOSIT" && !c.paidAt);
  const amountCents = deposit?.amountCents ?? mission.contract.depositCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new OutcomeServiceError("Montant d’acompte invalide.");
  }

  const planSlug = mission.pack?.planSlug ?? "oaas-academic-research";
  let plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    plan = await db.plan.create({
      data: {
        slug: planSlug,
        name: `[TEST] ${mission.pack?.title ?? "Mission OaaS"}`,
        priceCents: amountCents,
        currency: mission.currency,
        interval: "one_time",
        features: { oaas: true, dataset: "TEST", packSlug: mission.pack?.slug ?? null },
        active: true,
      },
    });
  }

  const destination = destinationFor("MPESA");
  const publicRef = `TEST-${newPublicRef()}`;
  const now = new Date();
  const receiptNumber = newReceiptNumber(now);
  const fingerprint = receiptFingerprint({
    publicNumber: receiptNumber,
    invoiceRef: publicRef,
    amountCents,
    currency: mission.currency,
    channel: "MPESA",
    confirmedAt: now.toISOString(),
  });

  const result = await db.$transaction(async (tx) => {
    const order = await tx.paymentOrder.create({
      data: {
        userId: input.userId,
        planId: plan!.id,
        outcomeMissionId: mission.id,
        amountCents,
        currency: mission.currency,
        status: "PAID",
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        outcomeMissionId: mission.id,
        provider: "MPESA",
        providerRef: publicRef,
        number: publicRef,
        amountDueCents: amountCents,
        amountPaidCents: amountCents,
        currency: mission.currency,
        status: "paid",
      },
    });
    const intent = await tx.paymentIntent.create({
      data: {
        publicRef,
        userId: input.userId,
        orderId: order.id,
        planId: plan!.id,
        outcomeMissionId: mission.id,
        invoiceId: invoice.id,
        channel: "MPESA",
        amountCents,
        currency: mission.currency,
        destinationAccount: destination.account,
        status: "PAID",
        paidAt: now,
        activatedAt: now,
        providerTxnRef: `TEST-OAAS-${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16)}`,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(now.getTime() + 7 * 86400000),
        retentionUntil: new Date(now.getTime() + 365 * 86400000),
        riskLevel: "LOW",
      },
    });
    await tx.payment.upsert({
      where: { providerRef: publicRef },
      update: { status: "SUCCEEDED", amountCents, outcomeMissionId: mission.id },
      create: {
        userId: input.userId,
        outcomeMissionId: mission.id,
        provider: "MPESA",
        providerRef: publicRef,
        amountCents,
        currency: mission.currency,
        status: "SUCCEEDED",
      },
    });
    const receipt = await tx.paymentReceipt.create({
      data: {
        publicNumber: receiptNumber,
        intentId: intent.id,
        invoiceId: invoice.id,
        amountCents,
        currency: mission.currency,
        channel: "MPESA",
        confirmedAt: now,
        fingerprint,
      },
    });
    await tx.outcomeEvidence.create({
      data: {
        missionId: mission.id,
        kind: "PAYMENT",
        title: "Paiement TEST confirmé",
        summary: "Provider TEST local — pas un encaissement Stripe/bancaire réel",
        payload: {
          publicRef,
          test: true,
          stripe: STRIPE_OAAS_STATUS,
          amountCents,
          currency: mission.currency,
        },
        invented: false,
        checksum: createHash("sha256").update(publicRef).digest("hex"),
      },
    });
    const unlock = await unlockMissionAfterPayment(tx, {
      missionId: mission.id,
      paymentIntentId: intent.id,
      actorId: input.userId,
    });
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "OAAS_TEST_PAYMENT_CONFIRMED",
        entityType: "OutcomeMission",
        entityId: mission.id,
        newValue: { publicRef, amountCents, unlock, dataset: "TEST" },
      },
    });
    return { publicRef, receiptNumber: receipt.publicNumber, unlock };
  });

  return {
    publicRef: result.publicRef,
    status: "PAID" as const,
    reused: false as const,
    test: true as const,
    stripe: STRIPE_OAAS_STATUS,
    receiptNumber: result.receiptNumber,
    unlocked: result.unlock.unlocked,
  };
}
