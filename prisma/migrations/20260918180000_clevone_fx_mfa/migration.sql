-- AlterTable User MFA lockout / recovery
ALTER TABLE "User" ADD COLUMN "mfaRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "mfaFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "mfaLockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaLastVerifiedAt" TIMESTAMP(3);

-- AlterTable Invoice frozen FX snapshot
ALTER TABLE "Invoice" ADD COLUMN "fxPair" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fxRateUnits" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "fxSource" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "fxEffectiveAt" TIMESTAMP(3);

-- AlterTable PaymentOrder frozen FX snapshot
ALTER TABLE "PaymentOrder" ADD COLUMN "fxPair" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "fxRateUnits" INTEGER;
ALTER TABLE "PaymentOrder" ADD COLUMN "fxSource" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "fxEffectiveAt" TIMESTAMP(3);
ALTER TABLE "PaymentOrder" ADD COLUMN "fxRateId" TEXT;

-- AlterTable PaymentIntent frozen FX snapshot
ALTER TABLE "PaymentIntent" ADD COLUMN "fxPair" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "fxRateUnits" INTEGER;
ALTER TABLE "PaymentIntent" ADD COLUMN "fxSource" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "fxEffectiveAt" TIMESTAMP(3);
ALTER TABLE "PaymentIntent" ADD COLUMN "fxRateId" TEXT;

-- CreateEnum
CREATE TYPE "FxRateStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUPERSEDED', 'REJECTED');

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL DEFAULT 'USD_CDF',
    "rateUnits" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "enteredById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "FxRateStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FxRate_pair_status_effectiveAt_idx" ON "FxRate"("pair", "status", "effectiveAt");
CREATE INDEX "FxRate_pair_approvedAt_idx" ON "FxRate"("pair", "approvedAt");

ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "FxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "FxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
