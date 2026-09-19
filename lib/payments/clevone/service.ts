import { Prisma, type PaymentChannel, type PaymentIntentStatus, type PrismaClient } from "@prisma/client";
import { db as defaultDb } from "@/lib/db/client";
import { antivirusConfigured, antivirusScanner, type AntivirusScanner } from "@/lib/documents/antivirus-scanner";
import { privateStorage, privateStorageConfigured, type StorageProvider } from "@/lib/storage";
import { sendEmail } from "@/lib/email/service";
import { logger } from "@/lib/observability/logger";
import { destinationFor, isPaymentChannel, type PaymentChannelId } from "./accounts";
import { providerFromChannel, quoteChannelAmount } from "./amount";
import { getActiveUsdCdfRate } from "./fx";
import { financialSourceConnectedFromEnv, matchPayment } from "./matching";
import { assertAllowedProof, isAllowedProofMime } from "./mime";
import { newPublicRef, newReceiptNumber, receiptFingerprint } from "./references";
import { assertTransition, canActivate, isOpenForProof } from "./state-machine";
import { decryptSecret, mfaRequiredForConfirm, verifyTotp } from "./totp";
import {
  ClevonePaymentError,
  INTENT_TTL_MS,
  MAX_PROOFS_PER_INTENT,
  MAX_PROOF_BYTES,
  PROOF_RETENTION_MS,
  SIGNED_PROOF_TTL_SECONDS,
  type PaymentIntentStatusId,
} from "./types";

type Db = PrismaClient;
type AuditContext = { ipHash: string | null; userAgent: string | null };

function proofObjectKey(userId: string, intentId: string, fileName: string) {
  const clean = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-80) || "proof";
  return `payments/${userId}/${intentId}/${crypto.randomUUID()}-${clean}`;
}

function periodEnd(interval: string, from: Date) {
  const end = new Date(from);
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 8 || trimmed.length > 500) {
    throw new ClevonePaymentError("Un motif explicite de 8 à 500 caractères est obligatoire.", 400, "VALIDATION");
  }
  return trimmed;
}

export class ClevonePaymentService {
  constructor(
    private readonly db: Db = defaultDb,
    private readonly storage: StorageProvider | null = null,
    private readonly scanner: AntivirusScanner | null = null,
  ) {}

  private files() {
    return this.storage ?? privateStorage();
  }

  private virus() {
    return this.scanner ?? antivirusScanner();
  }

  private assertProofInfrastructure() {
    const storageReady = Boolean(this.storage) || privateStorageConfigured();
    const virusReady = Boolean(this.scanner && this.scanner.engine !== "unconfigured") || antivirusConfigured();
    if (!storageReady || !virusReady) {
      throw new ClevonePaymentError("Service temporairement indisponible.", 503, "UNCONFIGURED");
    }
  }

  async createCheckout(input: {
    userId: string;
    userEmail: string;
    planSlug: string;
    channel: string;
    idempotencyKey: string;
  }) {
    if (!isPaymentChannel(input.channel)) {
      throw new ClevonePaymentError("Canal de paiement invalide.", 400, "VALIDATION");
    }
    const channel = input.channel;
    if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(input.idempotencyKey)) {
      throw new ClevonePaymentError("Clé d’idempotence invalide.", 400, "VALIDATION");
    }

    const existing = await this.db.paymentIntent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { publicRef: true, status: true, userId: true },
    });
    if (existing) {
      if (existing.userId !== input.userId) throw new ClevonePaymentError("Clé d’idempotence déjà utilisée.", 409, "CONFLICT");
      return { publicRef: existing.publicRef, reused: true as const };
    }

    const plan = await this.db.plan.findUnique({ where: { slug: input.planSlug } });
    if (!plan?.active) throw new ClevonePaymentError("Ce plan n’est pas disponible.", 404, "VALIDATION");
    const usdCdfRate = await getActiveUsdCdfRate(this.db);
    const quote = quoteChannelAmount({ priceCents: plan.priceCents, currency: plan.currency, channel, usdCdfRate });

    const active = await this.db.subscription.findFirst({
      where: { userId: input.userId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      select: { id: true },
    });
    if (active) throw new ClevonePaymentError("Un abonnement est déjà actif. Gérez-le depuis le tableau de bord.", 409, "CONFLICT");

    try {
      const created = await this.db.$transaction(async (tx) => {
        const publicRef = newPublicRef();
        const now = new Date();
        const order = await tx.paymentOrder.create({
          data: {
            userId: input.userId,
            planId: plan.id,
            amountCents: quote.amountCents,
            currency: quote.currency,
            status: "OPEN",
            fxPair: quote.fx?.pair ?? null,
            fxRateUnits: quote.fx?.rateUnits ?? null,
            fxSource: quote.fx?.source ?? null,
            fxEffectiveAt: quote.fx?.effectiveAt ?? null,
            fxRateId: quote.fx?.rateId ?? null,
          },
        });
        const subscription = await tx.subscription.create({
          data: {
            userId: input.userId,
            planId: plan.id,
            provider: providerFromChannel(channel),
            providerRef: publicRef,
            status: "INCOMPLETE",
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            subscriptionId: subscription.id,
            provider: providerFromChannel(channel),
            providerRef: publicRef,
            number: publicRef,
            amountDueCents: quote.amountCents,
            amountPaidCents: 0,
            currency: quote.currency,
            status: "open",
            fxPair: quote.fx?.pair ?? null,
            fxRateUnits: quote.fx?.rateUnits ?? null,
            fxSource: quote.fx?.source ?? null,
            fxEffectiveAt: quote.fx?.effectiveAt ?? null,
          },
        });
        const intent = await tx.paymentIntent.create({
          data: {
            publicRef,
            userId: input.userId,
            orderId: order.id,
            planId: plan.id,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            channel,
            amountCents: quote.amountCents,
            currency: quote.currency,
            destinationAccount: quote.destination.account,
            fxPair: quote.fx?.pair ?? null,
            fxRateUnits: quote.fx?.rateUnits ?? null,
            fxSource: quote.fx?.source ?? null,
            fxEffectiveAt: quote.fx?.effectiveAt ?? null,
            fxRateId: quote.fx?.rateId ?? null,
            status: "AWAITING_PAYMENT",
            expiresAt: new Date(now.getTime() + INTENT_TTL_MS),
            idempotencyKey: input.idempotencyKey,
            retentionUntil: new Date(now.getTime() + PROOF_RETENTION_MS),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: "CLEVONE_PAYMENT_INTENT_CREATED",
            entityType: "PaymentIntent",
            entityId: intent.id,
            newValue: { publicRef, channel, amountCents: quote.amountCents, currency: quote.currency },
          },
        });
        return { publicRef: intent.publicRef, reused: false as const, intentId: intent.id };
      });
      await this.notify(
        created.intentId,
        input.userId,
        "order_created",
        `Commande ${created.publicRef} créée. Paiement manuel CLEVONE en attente — ce n’est pas une confirmation bancaire.`,
      );
      return { publicRef: created.publicRef, reused: false as const };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replay = await this.db.paymentIntent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { publicRef: true, userId: true },
        });
        if (replay?.userId === input.userId) return { publicRef: replay.publicRef, reused: true as const };
        throw new ClevonePaymentError("Conflit d’idempotence.", 409, "CONFLICT");
      }
      throw error;
    }
  }

  async getByPublicRef(publicRef: string, actor: { id: string; admin?: boolean }) {
    const intent = await this.load(publicRef);
    if (intent.userId !== actor.id && !actor.admin) {
      throw new ClevonePaymentError("Accès refusé.", 403, "FORBIDDEN");
    }
    return this.expireIfNeeded(intent);
  }

  async listAdmin(filters: {
    status?: PaymentIntentStatus;
    channel?: PaymentChannel;
    currency?: string;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH";
    from?: Date;
    to?: Date;
    q?: string;
    page?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = 25;
    const where: Prisma.PaymentIntentWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.currency ? { currency: filters.currency } : {}),
      ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
      ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
      ...(filters.q ? { OR: [{ publicRef: { contains: filters.q, mode: "insensitive" } }, { providerTxnRef: { contains: filters.q, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.paymentIntent.findMany({
        where,
        include: { user: { select: { email: true, name: true } }, plan: true, attempts: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.paymentIntent.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async submitProof(input: {
    publicRef: string;
    userId: string;
    payerName: string;
    payerPhone: string;
    providerTxnRef: string;
    amountCents: number;
    currency: string;
    paidAtClient: string;
    destinationAccount: string;
    invoiceRef: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    idempotencyKey?: string;
  }) {
    this.assertProofInfrastructure();
    const intent = await this.expireIfNeeded(await this.requireOwner(input.publicRef, input.userId));
    if (intent.status === "EXPIRED") throw new ClevonePaymentError("Cette facture a expiré.", 410, "GONE");
    if (!isOpenForProof(intent.status)) {
      throw new ClevonePaymentError("Cette facture n’accepte plus de preuve.", 409, "CONFLICT");
    }

    const payerName = input.payerName.trim();
    const payerPhone = input.payerPhone.replace(/[^\d+]/g, "");
    const providerTxnRef = input.providerTxnRef.trim();
    if (payerName.length < 2 || payerName.length > 80) throw new ClevonePaymentError("Nom du payeur invalide.", 400, "VALIDATION");
    if (!/^\+?\d{8,15}$/.test(payerPhone)) throw new ClevonePaymentError("Téléphone du payeur invalide.", 400, "VALIDATION");
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(providerTxnRef)) throw new ClevonePaymentError("Référence de transaction invalide.", 400, "VALIDATION");
    if (!isAllowedProofMime(input.mimeType)) throw new ClevonePaymentError("Seuls JPG, PNG et PDF sont acceptés.", 400, "VALIDATION");
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_PROOF_BYTES) {
      throw new ClevonePaymentError("Fichier trop volumineux ou vide.", 400, "VALIDATION");
    }
    const paidAt = new Date(input.paidAtClient);
    if (Number.isNaN(paidAt.getTime())) throw new ClevonePaymentError("Date/heure de paiement invalide.", 400, "VALIDATION");

    const proofs = await this.db.paymentProof.count({ where: { intentId: intent.id } });
    if (proofs >= MAX_PROOFS_PER_INTENT) throw new ClevonePaymentError("Quota de preuves atteint pour cette facture.", 429, "CONFLICT");

    const duplicate = await this.db.paymentIntent.findFirst({
      where: { providerTxnRef, id: { not: intent.id } },
      select: { id: true },
    });
    const knownTxn = await this.db.providerTransaction.findUnique({
      where: { providerTxnRef },
      select: { id: true, intentId: true },
    });

    const destination = destinationFor(intent.channel as PaymentChannelId);
    const match = matchPayment({
      invoiceRef: intent.publicRef,
      submittedInvoiceRef: input.invoiceRef,
      expectedAmountCents: intent.amountCents,
      submittedAmountCents: input.amountCents,
      expectedCurrency: intent.currency,
      submittedCurrency: input.currency,
      expectedDestination: intent.destinationAccount,
      submittedDestination: input.destinationAccount || destination.account,
      submittedPayerPhone: payerPhone,
      providerTxnRef,
      paidAtClient: paidAt,
      intentCreatedAt: intent.createdAt,
      intentExpiresAt: intent.expiresAt,
      priorStatus: intent.status,
      duplicateProviderRef: Boolean(duplicate || (knownTxn && knownTxn.intentId && knownTxn.intentId !== intent.id)),
      financialSourceConnected: financialSourceConnectedFromEnv(),
      financialSourceConfirmed: false,
    });

    if (match.matchClass === "REJECT" && duplicate) {
      throw new ClevonePaymentError("Cette référence fournisseur a déjà été utilisée.", 409, "DUPLICATE");
    }

    const objectKey = proofObjectKey(input.userId, intent.id, input.fileName);
    const fromStatus = intent.status;
    assertTransition(fromStatus, "PROOF_SUBMITTED");
    assertTransition("PROOF_SUBMITTED", "MATCHING");
    assertTransition("MATCHING", match.nextStatus);

    const attempt = await this.db.$transaction(async (tx) => {
      const createdAttempt = await tx.paymentAttempt.create({
        data: {
          intentId: intent.id,
          channel: intent.channel,
          amountCents: input.amountCents,
          currency: input.currency.trim().toUpperCase(),
          payerName,
          payerPhone,
          providerTxnRef,
          paidAtClient: paidAt,
          destinationAccount: input.destinationAccount || destination.account,
        },
      });
      const proof = await tx.paymentProof.create({
        data: {
          intentId: intent.id,
          attemptId: createdAttempt.id,
          objectKey,
          fileName: input.fileName.slice(-120),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          scanStatus: "PENDING",
        },
      });
      await this.transition(tx, intent.id, fromStatus, "PROOF_SUBMITTED", "Preuve client déposée — vérification, pas une confirmation bancaire.", input.userId);
      await this.transition(tx, intent.id, "PROOF_SUBMITTED", "MATCHING", "Rapprochement automatique des champs déclarés.", input.userId);
      await this.transition(tx, intent.id, "MATCHING", match.nextStatus, match.reasons.join(" "), input.userId, {
        matchClass: match.matchClass,
        riskLevel: match.riskLevel,
      });
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: match.nextStatus,
          matchClass: match.matchClass,
          riskLevel: match.riskLevel,
          providerTxnRef: match.matchClass === "REJECT" ? intent.providerTxnRef : providerTxnRef,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: "CLEVONE_PROOF_SUBMITTED",
          entityType: "PaymentIntent",
          entityId: intent.id,
          newValue: { status: match.nextStatus, matchClass: match.matchClass, proofId: proof.id },
        },
      });
      return { attempt: createdAttempt, proof };
    });

    let uploadUrl: string;
    try {
      uploadUrl = await this.files().createSignedUpload({
        objectKey,
        contentType: input.mimeType,
        expiresInSeconds: SIGNED_PROOF_TTL_SECONDS,
      });
    } catch (error) {
      logger.error("clevone.proof.upload_url_error", error, { intentId: intent.id });
      throw new ClevonePaymentError("Service temporairement indisponible.", 503, "UNCONFIGURED");
    }

    return {
      proofId: attempt.proof.id,
      attemptId: attempt.attempt.id,
      uploadUrl,
      status: match.nextStatus,
      matchClass: match.matchClass,
      message: "Preuve soumise ≠ paiement confirmé.",
    };
  }

  async confirmProof(input: { publicRef: string; userId: string; proofId: string }) {
    const intent = await this.requireOwner(input.publicRef, input.userId);
    const proof = await this.db.paymentProof.findFirst({ where: { id: input.proofId, intentId: intent.id } });
    if (!proof) throw new ClevonePaymentError("Preuve introuvable.", 404, "VALIDATION");
    if (proof.scanStatus === "REJECTED") throw new ClevonePaymentError("Fichier rejeté.", 422, "VALIDATION");
    if (proof.isUploaded && proof.scanStatus === "CLEAN") {
      return { proofId: proof.id, scanStatus: proof.scanStatus };
    }

    const digest = await this.files().digest(proof.objectKey);
    if (!digest.exists || digest.sizeBytes == null || !digest.checksum || !digest.reference) {
      throw new ClevonePaymentError("Le fichier stocké est introuvable.", 422, "VALIDATION");
    }
    if (digest.sizeBytes !== proof.sizeBytes || digest.sizeBytes > MAX_PROOF_BYTES) {
      await this.rejectProof(proof.id, digest.checksum, digest.sizeBytes);
      throw new ClevonePaymentError("Taille de fichier invalide.", 422, "VALIDATION");
    }
    const prefix = await this.files().readPrefix(proof.objectKey, 16);
    const mime = assertAllowedProof(proof.mimeType, prefix);
    if (!mime.ok) {
      await this.rejectProof(proof.id, digest.checksum, digest.sizeBytes);
      throw new ClevonePaymentError(mime.reason, 422, "VALIDATION");
    }

    await this.db.paymentProof.update({
      where: { id: proof.id },
      data: { isUploaded: true, checksum: digest.checksum, sizeBytes: digest.sizeBytes, scanStatus: "SCANNING" },
    });

    const scan = await this.virus().scan({
      bucket: digest.reference.bucket,
      objectKey: digest.reference.objectKey,
      generation: digest.reference.generation,
      checksum: digest.checksum,
      sizeBytes: digest.sizeBytes,
      mimeType: proof.mimeType,
    });
    if (scan.verdict === "unavailable") {
      await this.db.paymentProof.update({
        where: { id: proof.id },
        data: { scanStatus: "PENDING", checksum: digest.checksum },
      });
      throw new ClevonePaymentError("Service temporairement indisponible.", 503, "UNCONFIGURED");
    }
    const scanStatus = scan.verdict === "clean" ? "CLEAN" as const : "REJECTED" as const;
    await this.db.paymentProof.update({
      where: { id: proof.id },
      data: { scanStatus, scannedAt: new Date(), checksum: digest.checksum },
    });
    if (scanStatus === "REJECTED") {
      await this.quarantineProof(proof.objectKey, proof.id, input.userId);
      throw new ClevonePaymentError("Le fichier a été rejeté par l’analyse.", 422, "VALIDATION");
    }
    await this.notify(intent.id, intent.userId, "proof_received", `Preuve reçue pour ${intent.publicRef}. Cela ne confirme pas le paiement.`);
    return { proofId: proof.id, scanStatus };
  }

  async signedProofUrl(proofId: string, actor: { id: string; admin: boolean }) {
    const proof = await this.db.paymentProof.findUnique({ where: { id: proofId }, include: { intent: true } });
    if (!proof) throw new ClevonePaymentError("Preuve introuvable.", 404, "VALIDATION");
    if (proof.intent.userId !== actor.id && !actor.admin) throw new ClevonePaymentError("Accès refusé.", 403, "FORBIDDEN");
    return this.files().createSignedDownload(proof.objectKey, proof.fileName, SIGNED_PROOF_TTL_SECONDS, true);
  }

  async decide(input: {
    publicRef: string;
    actorId: string;
    actorRole: string;
    mfaEnabled: boolean;
    mfaSecretEnc: string | null;
    totp?: string;
    action: "PROPOSE_PAID" | "CONFIRM_PAID" | "REJECT" | "CORRECT";
    reason: string;
    context: AuditContext;
  }) {
    const reason = requireReason(input.reason);
    this.assertMfa(input);
    const intent = await this.expireIfNeeded(await this.load(input.publicRef));
    const fromStatus = intent.status;

    if (input.action === "PROPOSE_PAID") {
      if (fromStatus !== "REVIEW_REQUIRED") throw new ClevonePaymentError("Seuls les dossiers en revue peuvent être proposés.", 409, "CONFLICT");
      await this.db.$transaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { proposedPaidById: input.actorId, proposedPaidAt: new Date() },
        });
        await tx.reconciliationDecision.create({
          data: {
            intentId: intent.id,
            actorId: input.actorId,
            action: "PROPOSE_PAID",
            fromStatus,
            toStatus: "REVIEW_REQUIRED",
            reason,
            matchClass: intent.matchClass,
            riskLevel: intent.riskLevel,
            matchSnapshot: { proposed: true },
            ...input.context,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: "CLEVONE_PROPOSE_PAID",
            entityType: "PaymentIntent",
            entityId: intent.id,
            oldValue: { status: fromStatus },
            newValue: { proposedPaidById: input.actorId },
            ...input.context,
          },
        });
      });
      return { status: "REVIEW_REQUIRED" as const, proposed: true };
    }

    if (input.action === "CONFIRM_PAID") {
      if (fromStatus !== "REVIEW_REQUIRED") throw new ClevonePaymentError("Confirmation refusée : le dossier n’est pas en revue.", 409, "CONFLICT");
      if (!intent.proposedPaidById) throw new ClevonePaymentError("Un premier contrôle est obligatoire avant confirmation.", 409, "CONFLICT");
      if (intent.proposedPaidById === input.actorId) {
        throw new ClevonePaymentError("Le second contrôle doit être effectué par un autre administrateur.", 403, "FORBIDDEN");
      }
      this.assertMfa(input);
      assertTransition("REVIEW_REQUIRED", "PAID");
      const confirmedAt = new Date();
      const receiptNumber = newReceiptNumber(confirmedAt);
      const fingerprint = receiptFingerprint({
        publicNumber: receiptNumber,
        invoiceRef: intent.publicRef,
        amountCents: intent.amountCents,
        currency: intent.currency,
        channel: intent.channel,
        confirmedAt: confirmedAt.toISOString(),
      });

      const updated = await this.db.$transaction(async (tx) => {
        const moved = await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: "REVIEW_REQUIRED", proposedPaidById: { not: input.actorId } },
          data: { status: "PAID", paidAt: confirmedAt },
        });
        if (moved.count !== 1) throw new ClevonePaymentError("Conflit de confirmation.", 409, "CONFLICT");
        await this.transition(tx, intent.id, "REVIEW_REQUIRED", "PAID", reason, input.actorId);
        await tx.reconciliationDecision.create({
          data: {
            intentId: intent.id,
            actorId: input.actorId,
            action: "CONFIRM_PAID",
            fromStatus: "REVIEW_REQUIRED",
            toStatus: "PAID",
            reason,
            matchClass: intent.matchClass,
            riskLevel: intent.riskLevel,
            matchSnapshot: { dualControl: true, proposedPaidById: intent.proposedPaidById },
            ...input.context,
          },
        });
        if (!canActivate("PAID")) throw new ClevonePaymentError("Activation interdite.", 409, "CONFLICT");
        if (intent.invoiceId) {
          await tx.invoice.update({
            where: { id: intent.invoiceId },
            data: { status: "paid", amountPaidCents: intent.amountCents },
          });
        }
        if (intent.subscriptionId) {
          const plan = await tx.plan.findUnique({ where: { id: intent.planId } });
          await tx.subscription.update({
            where: { id: intent.subscriptionId },
            data: {
              status: "ACTIVE",
              startedAt: confirmedAt,
              currentPeriodEnd: periodEnd(plan?.interval ?? "month", confirmedAt),
            },
          });
        }
        await tx.paymentOrder.update({ where: { id: intent.orderId }, data: { status: "PAID" } });
        await tx.payment.upsert({
          where: { providerRef: intent.publicRef },
          update: { status: "SUCCEEDED", amountCents: intent.amountCents },
          create: {
            userId: intent.userId,
            subscriptionId: intent.subscriptionId,
            provider: providerFromChannel(intent.channel as PaymentChannelId),
            providerRef: intent.publicRef,
            amountCents: intent.amountCents,
            currency: intent.currency,
            status: "SUCCEEDED",
          },
        });
        const receipt = await tx.paymentReceipt.upsert({
          where: { intentId: intent.id },
          update: {},
          create: {
            publicNumber: receiptNumber,
            intentId: intent.id,
            invoiceId: intent.invoiceId ?? intent.publicRef,
            amountCents: intent.amountCents,
            currency: intent.currency,
            channel: intent.channel,
            confirmedAt,
            fingerprint,
          },
        });
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { activatedAt: confirmedAt },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: "CLEVONE_CONFIRM_PAID",
            entityType: "PaymentIntent",
            entityId: intent.id,
            oldValue: { status: fromStatus, proposedPaidById: intent.proposedPaidById },
            newValue: { status: "PAID", receipt: receipt.publicNumber },
            ...input.context,
          },
        });
        return receipt;
      });

      await this.notify(intent.id, intent.userId, "payment_paid", `Votre paiement ${intent.publicRef} est confirmé par rapprochement manuel. Ce n’est pas un encaissement bancaire automatique.`);
      await this.notify(intent.id, intent.userId, "receipt_available", `Reçu ${updated.publicNumber} disponible pour ${intent.publicRef}.`);
      return { status: "PAID" as const, receiptNumber: updated.publicNumber, fingerprint: updated.fingerprint };
    }

    if (input.action === "REJECT") {
      if (!["REVIEW_REQUIRED", "PENDING", "AWAITING_PAYMENT"].includes(fromStatus)) {
        throw new ClevonePaymentError("Rejet impossible dans cet état.", 409, "CONFLICT");
      }
      assertTransition(fromStatus, "REJECTED");
      await this.db.$transaction(async (tx) => {
        const moved = await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: fromStatus },
          data: { status: "REJECTED" },
        });
        if (moved.count !== 1) throw new ClevonePaymentError("Conflit de rejet.", 409, "CONFLICT");
        await this.transition(tx, intent.id, fromStatus, "REJECTED", reason, input.actorId);
        await tx.reconciliationDecision.create({
          data: {
            intentId: intent.id,
            actorId: input.actorId,
            action: "REJECT",
            fromStatus,
            toStatus: "REJECTED",
            reason,
            matchClass: intent.matchClass,
            riskLevel: intent.riskLevel,
            ...input.context,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: "CLEVONE_REJECTED",
            entityType: "PaymentIntent",
            entityId: intent.id,
            oldValue: { status: fromStatus },
            newValue: { status: "REJECTED" },
            ...input.context,
          },
        });
      });
      await this.notify(intent.id, intent.userId, "payment_rejected", `Votre paiement ${intent.publicRef} a été rejeté.`);
      return { status: "REJECTED" as const };
    }

    assertTransition(fromStatus, "PENDING");
    await this.db.$transaction(async (tx) => {
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "PENDING" } });
      await this.transition(tx, intent.id, fromStatus, "PENDING", reason, input.actorId);
      await tx.reconciliationDecision.create({
        data: {
          intentId: intent.id,
          actorId: input.actorId,
          action: "CORRECT",
          fromStatus,
          toStatus: "PENDING",
          reason,
          ...input.context,
        },
      });
    });
    await this.notify(intent.id, intent.userId, "info_requested", `Des informations complémentaires sont requises pour ${intent.publicRef}.`);
    return { status: "PENDING" as const };
  }

  async refund(input: {
    publicRef: string;
    actorId: string;
    reason: string;
    idempotencyKey: string;
    mfaEnabled: boolean;
    mfaSecretEnc: string | null;
    totp?: string;
    context: AuditContext;
  }) {
    const reason = requireReason(input.reason);
    this.assertMfa(input);
    const intent = await this.load(input.publicRef);
    if (intent.status !== "PAID") throw new ClevonePaymentError("Seul un paiement confirmé peut être remboursé.", 409, "CONFLICT");
    const existing = await this.db.paymentRefund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    return this.db.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.create({
        data: {
          intentId: intent.id,
          amountCents: intent.amountCents,
          currency: intent.currency,
          reason,
          status: "PROCESSED",
          requestedById: input.actorId,
          reviewedById: input.actorId,
          reviewedAt: new Date(),
          processedAt: new Date(),
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "REFUNDED" } });
      await this.transition(tx, intent.id, "PAID", "REFUNDED", reason, input.actorId);
      if (intent.subscriptionId) {
        await tx.subscription.update({ where: { id: intent.subscriptionId }, data: { status: "CANCELED" } });
      }
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "CLEVONE_REFUNDED",
          entityType: "PaymentIntent",
          entityId: intent.id,
          oldValue: { status: "PAID" },
          newValue: { status: "REFUNDED", note: "Remboursement BICUNI enregistré. Aucun virement bancaire n’a été déclenché." },
          ...input.context,
        },
      });
      return refund;
    });
  }

  private assertMfa(input: { mfaEnabled: boolean; mfaSecretEnc: string | null; totp?: string }) {
    if (!mfaRequiredForConfirm() && !input.mfaEnabled) return;
    if (!input.mfaEnabled || !input.mfaSecretEnc) {
      throw new ClevonePaymentError("MFA administrateur requis pour cette action financière.", 403, "FORBIDDEN");
    }
    try {
      if (!input.totp || !verifyTotp(decryptSecret(input.mfaSecretEnc), input.totp)) {
        throw new ClevonePaymentError("Code MFA invalide.", 403, "FORBIDDEN");
      }
    } catch (error) {
      if (error instanceof ClevonePaymentError) throw error;
      throw new ClevonePaymentError("Code MFA invalide.", 403, "FORBIDDEN");
    }
  }

  private async load(publicRef: string) {
    const intent = await this.db.paymentIntent.findUnique({
      where: { publicRef },
      include: {
        plan: true,
        user: { select: { id: true, email: true, name: true } },
        attempts: { orderBy: { createdAt: "desc" }, include: { proofs: true } },
        proofs: { orderBy: { createdAt: "desc" } },
        decisions: { orderBy: { createdAt: "desc" }, include: { actor: { select: { email: true, name: true } } } },
        transitions: { orderBy: { createdAt: "asc" } },
        receipt: true,
        refunds: true,
        notifications: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!intent) throw new ClevonePaymentError("Facture introuvable.", 404, "VALIDATION");
    return intent;
  }

  private async requireOwner(publicRef: string, userId: string) {
    const intent = await this.load(publicRef);
    if (intent.userId !== userId) throw new ClevonePaymentError("Accès refusé.", 403, "FORBIDDEN");
    return intent;
  }

  private async expireIfNeeded<T extends { id: string; status: PaymentIntentStatus; expiresAt: Date }>(intent: T) {
    if ((intent.status === "AWAITING_PAYMENT" || intent.status === "PENDING") && intent.expiresAt.getTime() <= Date.now()) {
      assertTransition(intent.status as PaymentIntentStatusId, "EXPIRED");
      await this.db.$transaction(async (tx) => {
        const moved = await tx.paymentIntent.updateMany({
          where: { id: intent.id, status: intent.status },
          data: { status: "EXPIRED" },
        });
        if (moved.count === 1) {
          await this.transition(tx, intent.id, intent.status, "EXPIRED", "Délai de 24 h dépassé.", null);
        }
      });
      return { ...intent, status: "EXPIRED" as const };
    }
    return intent;
  }

  private async transition(
    tx: Prisma.TransactionClient,
    intentId: string,
    fromStatus: PaymentIntentStatus,
    toStatus: PaymentIntentStatus,
    reason: string,
    actorId: string | null,
    metadata?: Prisma.InputJsonValue,
  ) {
    assertTransition(fromStatus as PaymentIntentStatusId, toStatus as PaymentIntentStatusId);
    await tx.paymentStateTransition.create({
      data: { intentId, fromStatus, toStatus, reason, actorId: actorId ?? undefined, metadata },
    });
  }

  private async rejectProof(id: string, checksum: string, sizeBytes: number) {
    await this.db.paymentProof.update({
      where: { id },
      data: { isUploaded: true, checksum, sizeBytes, scanStatus: "REJECTED", scannedAt: new Date() },
    });
  }

  private async quarantineProof(objectKey: string, proofId: string, actorId: string) {
    try {
      await this.files().delete(objectKey);
    } catch (error) {
      logger.error("clevone.proof.quarantine_error", error, { proofId });
    }
    await this.db.auditLog.create({
      data: {
        actorId,
        action: "CLEVONE_PROOF_QUARANTINED",
        entityType: "PaymentProof",
        entityId: proofId,
        newValue: { objectKey: "deleted" },
      },
    });
  }

  private async notify(intentId: string, userId: string, template: string, subject: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    const smsConfigured = Boolean(process.env.CLEVONE_SMS_PROVIDER_KEY?.trim());
    const whatsappConfigured = Boolean(process.env.CLEVONE_WHATSAPP_PROVIDER_KEY?.trim());

    await this.db.paymentNotification.create({
      data: {
        intentId,
        userId,
        channel: "SMS",
        template,
        status: smsConfigured ? "FAILED" : "SKIPPED_UNCONFIGURED",
        error: smsConfigured ? "Fournisseur SMS non implémenté." : "SMS non configuré.",
      },
    });
    await this.db.paymentNotification.create({
      data: {
        intentId,
        userId,
        channel: "WHATSAPP",
        template,
        status: whatsappConfigured ? "FAILED" : "SKIPPED_UNCONFIGURED",
        error: whatsappConfigured ? "Fournisseur WhatsApp non implémenté." : "WhatsApp non configuré.",
      },
    });

    try {
      const sent = await sendEmail({
        to: user.email,
        subject: `BICUNI — ${subject}`,
        html: `<p>${subject}</p><p>Preuve soumise n’est jamais une confirmation à elle seule. Statut réel consultable avec votre référence de facture.</p>`,
      });
      await this.db.paymentNotification.create({
        data: {
          intentId,
          userId,
          channel: "EMAIL",
          template,
          status: sent.id === "development-skip" ? "SKIPPED_UNCONFIGURED" : "SENT",
          providerMessageId: sent.id === "development-skip" ? null : sent.id,
        },
      });
    } catch (error) {
      logger.error("clevone.notify.email_failed", error, { intentId });
      await this.db.paymentNotification.create({
        data: {
          intentId,
          userId,
          channel: "EMAIL",
          template,
          status: "FAILED",
          error: "fournisseur_email_indisponible",
        },
      });
    }
  }
}

export const clevonePayments = new ClevonePaymentService();
