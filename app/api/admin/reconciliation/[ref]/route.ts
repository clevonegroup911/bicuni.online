import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { db } from "@/lib/db/client";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { paymentErrorResponse } from "@/lib/payments/clevone/http";
import { maskEmail, maskPhone } from "@/lib/payments/clevone/references";
import { getClevoneAccounts } from "@/lib/payments/clevone/accounts";

const decisionSchema = z.object({
  action: z.enum(["PROPOSE_PAID", "CONFIRM_PAID", "REJECT", "CORRECT"]),
  reason: z.string().min(8).max(500),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    const actor = await requireAdminApi("admin:payments:read", request);
    const { ref } = await context.params;
    const intent = await clevonePayments.getByPublicRef(ref, { id: actor.id, admin: true });
    const accounts = getClevoneAccounts();
    return NextResponse.json({
      id: intent.id,
      publicRef: intent.publicRef,
      status: intent.status,
      matchClass: intent.matchClass,
      riskLevel: intent.riskLevel,
      amountCents: intent.amountCents,
      currency: intent.currency,
      channel: intent.channel,
      expiresAt: intent.expiresAt,
      proposedPaidById: intent.proposedPaidById,
      destination: accounts.destinations[intent.channel],
      user: { email: maskEmail(intent.user.email), name: intent.user.name },
      planName: intent.plan.name,
      attempts: intent.attempts.map((attempt) => ({
        id: attempt.id,
        payerName: attempt.payerName,
        payerPhone: maskPhone(attempt.payerPhone),
        providerTxnRef: attempt.providerTxnRef,
        amountCents: attempt.amountCents,
        currency: attempt.currency,
        paidAtClient: attempt.paidAtClient,
        destinationAccount: attempt.destinationAccount,
        proofs: attempt.proofs.map((proof) => ({
          id: proof.id,
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          scanStatus: proof.scanStatus,
          sizeBytes: proof.sizeBytes,
        })),
      })),
      decisions: intent.decisions.map((decision) => ({
        id: decision.id,
        action: decision.action,
        reason: decision.reason,
        fromStatus: decision.fromStatus,
        toStatus: decision.toStatus,
        createdAt: decision.createdAt,
        actor: decision.actor.name ?? maskEmail(decision.actor.email),
      })),
      transitions: intent.transitions,
      receipt: intent.receipt,
      notifications: intent.notifications.map((item) => ({
        channel: item.channel,
        status: item.status,
        template: item.template,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await context.params;
    const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
    const permission = parsed.data.action === "CONFIRM_PAID" ? "admin:payments:confirm" : "admin:payments:review";
    const actor = await requireAdminApi(permission, request);
    const user = await db.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, mfaEnabled: true, mfaSecretEnc: true },
    });
    if (!user) return NextResponse.json({ error: "Compte administratif introuvable." }, { status: 403 });
    const result = await clevonePayments.decide({
      publicRef: ref,
      actorId: user.id,
      actorRole: user.role,
      mfaEnabled: user.mfaEnabled,
      mfaSecretEnc: user.mfaSecretEnc,
      totp: parsed.data.totp,
      action: parsed.data.action,
      reason: parsed.data.reason,
      context: auditRequestContext(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (!(error instanceof ClevonePaymentError)) throw error;
    return paymentErrorResponse(error);
  }
}
