-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'RAWBANK';

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('MPESA', 'RAWBANK_CDF', 'RAWBANK_USD');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('AWAITING_PAYMENT', 'PROOF_SUBMITTED', 'MATCHING', 'PENDING', 'REVIEW_REQUIRED', 'PAID', 'REJECTED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMatchClass" AS ENUM ('STRONG', 'INCOMPLETE', 'VARIANCE', 'REJECT');

-- CreateEnum
CREATE TYPE "PaymentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReconciliationAction" AS ENUM ('PROPOSE_PAID', 'CONFIRM_PAID', 'REJECT', 'CORRECT', 'EXPIRE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_UNCONFIGURED');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "channel" "PaymentChannel" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "matchClass" "PaymentMatchClass",
    "riskLevel" "PaymentRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "proposedPaidById" TEXT,
    "proposedPaidAt" TIMESTAMP(3),
    "providerTxnRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerPhone" TEXT NOT NULL,
    "providerTxnRef" TEXT NOT NULL,
    "paidAtClient" TIMESTAMP(3) NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL DEFAULT '',
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "isUploaded" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderTransaction" (
    "id" TEXT NOT NULL,
    "intentId" TEXT,
    "channel" "PaymentChannel" NOT NULL,
    "providerTxnRef" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "counterparty" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDecision" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ReconciliationAction" NOT NULL,
    "fromStatus" "PaymentIntentStatus" NOT NULL,
    "toStatus" "PaymentIntentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "matchClass" "PaymentMatchClass",
    "riskLevel" "PaymentRiskLevel",
    "matchSnapshot" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentStateTransition" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "fromStatus" "PaymentIntentStatus" NOT NULL,
    "toStatus" "PaymentIntentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentStateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "publicNumber" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentNotification" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");
CREATE UNIQUE INDEX "PaymentIntent_publicRef_key" ON "PaymentIntent"("publicRef");
CREATE UNIQUE INDEX "PaymentIntent_invoiceId_key" ON "PaymentIntent"("invoiceId");
CREATE UNIQUE INDEX "PaymentIntent_providerTxnRef_key" ON "PaymentIntent"("providerTxnRef");
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");
CREATE INDEX "PaymentIntent_userId_status_createdAt_idx" ON "PaymentIntent"("userId", "status", "createdAt");
CREATE INDEX "PaymentIntent_status_channel_currency_createdAt_idx" ON "PaymentIntent"("status", "channel", "currency", "createdAt");
CREATE INDEX "PaymentIntent_expiresAt_status_idx" ON "PaymentIntent"("expiresAt", "status");
CREATE INDEX "PaymentAttempt_intentId_createdAt_idx" ON "PaymentAttempt"("intentId", "createdAt");
CREATE INDEX "PaymentProof_intentId_scanStatus_idx" ON "PaymentProof"("intentId", "scanStatus");
CREATE UNIQUE INDEX "ProviderTransaction_providerTxnRef_key" ON "ProviderTransaction"("providerTxnRef");
CREATE INDEX "ProviderTransaction_channel_occurredAt_idx" ON "ProviderTransaction"("channel", "occurredAt");
CREATE INDEX "ReconciliationDecision_intentId_createdAt_idx" ON "ReconciliationDecision"("intentId", "createdAt");
CREATE INDEX "PaymentStateTransition_intentId_createdAt_idx" ON "PaymentStateTransition"("intentId", "createdAt");
CREATE UNIQUE INDEX "PaymentReceipt_publicNumber_key" ON "PaymentReceipt"("publicNumber");
CREATE UNIQUE INDEX "PaymentReceipt_intentId_key" ON "PaymentReceipt"("intentId");
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");
CREATE INDEX "PaymentRefund_intentId_status_idx" ON "PaymentRefund"("intentId", "status");
CREATE INDEX "PaymentNotification_intentId_createdAt_idx" ON "PaymentNotification"("intentId", "createdAt");

ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderTransaction" ADD CONSTRAINT "ProviderTransaction_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationDecision" ADD CONSTRAINT "ReconciliationDecision_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationDecision" ADD CONSTRAINT "ReconciliationDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentStateTransition" ADD CONSTRAINT "PaymentStateTransition_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
