-- AlterTable Invoice: subscription optional for OaaS invoices
ALTER TABLE "Invoice" ALTER COLUMN "subscriptionId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "outcomeMissionId" TEXT;
CREATE INDEX "Invoice_outcomeMissionId_createdAt_idx" ON "Invoice"("outcomeMissionId", "createdAt");

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "outcomeMissionId" TEXT;
CREATE INDEX "Payment_outcomeMissionId_idx" ON "Payment"("outcomeMissionId");

-- AlterTable PaymentOrder
ALTER TABLE "PaymentOrder" ADD COLUMN "outcomeMissionId" TEXT;
CREATE INDEX "PaymentOrder_outcomeMissionId_idx" ON "PaymentOrder"("outcomeMissionId");

-- AlterTable PaymentIntent
ALTER TABLE "PaymentIntent" ADD COLUMN "outcomeMissionId" TEXT;
CREATE INDEX "PaymentIntent_outcomeMissionId_idx" ON "PaymentIntent"("outcomeMissionId");

-- CreateEnum
CREATE TYPE "OutcomeMissionStatus" AS ENUM (
  'DRAFT', 'QUALIFICATION_REQUIRED', 'QUALIFIED', 'QUOTED', 'AWAITING_APPROVAL',
  'AWAITING_PAYMENT', 'PLANNED', 'READY', 'EXECUTING', 'AWAITING_HUMAN_REVIEW',
  'VERIFYING', 'DELIVERY_READY', 'DELIVERED', 'ACCEPTED', 'REVISION_REQUESTED',
  'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED', 'EXPIRED'
);

CREATE TYPE "OutcomeContractStatus" AS ENUM (
  'DRAFT', 'ISSUED', 'ACCEPTED', 'REFUSED', 'AMENDMENT_REQUESTED', 'SUPERSEDED'
);

CREATE TYPE "OutcomeTaskStatus" AS ENUM (
  'PENDING', 'READY', 'RUNNING', 'AWAITING_HUMAN', 'COMPLETED', 'FAILED', 'SKIPPED', 'BLOCKED'
);

CREATE TYPE "OutcomeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TYPE "OutcomeDeliverableStatus" AS ENUM ('DRAFT', 'READY', 'DELIVERED', 'ACCEPTED', 'REJECTED');

CREATE TYPE "OutcomeEvidenceKind" AS ENUM (
  'SOURCE', 'PROVENANCE', 'CHECKSUM', 'HUMAN_REVIEW', 'QUALITY_GATE', 'PAYMENT', 'SYSTEM'
);

CREATE TYPE "OutcomeQualityVerdict" AS ENUM ('PASS', 'FAIL', 'WARN', 'PENDING');

CREATE TYPE "OutcomeAcceptanceDecision" AS ENUM ('ACCEPTED', 'REVISION_REQUESTED', 'REJECTED');

CREATE TYPE "OutcomeCostKind" AS ENUM ('DEPOSIT', 'MILESTONE', 'BALANCE', 'OUT_OF_SCOPE', 'INSTITUTIONAL');

CREATE TYPE "OutcomeConfidentiality" AS ENUM ('STANDARD', 'RESTRICTED', 'CONFIDENTIAL', 'STRICT');

CREATE TYPE "OutcomePricingMode" AS ENUM ('FIXED', 'QUOTE');

-- CreateTable OutcomePack
CREATE TABLE "OutcomePack" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "resultDescription" TEXT NOT NULL,
  "requiredInputs" JSONB NOT NULL,
  "indicativeDeadlineDays" INTEGER NOT NULL,
  "revisionsIncluded" INTEGER NOT NULL DEFAULT 1,
  "acceptanceCriteria" JSONB NOT NULL,
  "confidentialityDefault" "OutcomeConfidentiality" NOT NULL DEFAULT 'STANDARD',
  "pricingMode" "OutcomePricingMode" NOT NULL DEFAULT 'QUOTE',
  "indicativePriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "planSlug" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomePack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomePack_slug_key" ON "OutcomePack"("slug");
CREATE INDEX "OutcomePack_active_sortOrder_idx" ON "OutcomePack"("active", "sortOrder");

CREATE TABLE "OutcomeMission" (
  "id" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "universityId" TEXT,
  "packId" TEXT,
  "title" TEXT NOT NULL,
  "originalRequest" TEXT NOT NULL,
  "expectedOutcome" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fr',
  "academicDomain" TEXT,
  "academicLevel" TEXT,
  "scope" TEXT,
  "exclusions" TEXT,
  "deadlineAt" TIMESTAMP(3),
  "maxBudgetCents" INTEGER,
  "confidentiality" "OutcomeConfidentiality" NOT NULL DEFAULT 'STANDARD',
  "acceptanceCriteria" JSONB,
  "status" "OutcomeMissionStatus" NOT NULL DEFAULT 'DRAFT',
  "estimatedCostCents" INTEGER,
  "actualCostCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "risks" JSONB,
  "integrityDeclaration" TEXT,
  "aiAssistanceLevel" TEXT,
  "nextStep" TEXT,
  "blockedReason" TEXT,
  "quotedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeMission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeMission_publicRef_key" ON "OutcomeMission"("publicRef");
CREATE INDEX "OutcomeMission_ownerId_status_createdAt_idx" ON "OutcomeMission"("ownerId", "status", "createdAt");
CREATE INDEX "OutcomeMission_status_updatedAt_idx" ON "OutcomeMission"("status", "updatedAt");
CREATE INDEX "OutcomeMission_packId_idx" ON "OutcomeMission"("packId");

CREATE TABLE "OutcomeMissionSource" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "documentId" TEXT,
  "label" TEXT NOT NULL,
  "uri" TEXT,
  "notes" TEXT,
  "accessible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeMissionSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeMissionSource_missionId_idx" ON "OutcomeMissionSource"("missionId");

CREATE TABLE "OutcomeContract" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "OutcomeContractStatus" NOT NULL DEFAULT 'DRAFT',
  "objective" TEXT NOT NULL,
  "deliverables" JSONB NOT NULL,
  "sourcesProvided" JSONB NOT NULL,
  "externalSourcesAllowed" JSONB NOT NULL,
  "acceptanceCriteria" JSONB NOT NULL,
  "deadlineAt" TIMESTAMP(3),
  "priceCents" INTEGER NOT NULL,
  "depositCents" INTEGER NOT NULL DEFAULT 0,
  "balanceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "revisionsIncluded" INTEGER NOT NULL DEFAULT 1,
  "limits" TEXT,
  "confidentiality" "OutcomeConfidentiality" NOT NULL DEFAULT 'STANDARD',
  "authorizations" JSONB,
  "humanValidationActions" JSONB,
  "cancellationTerms" TEXT,
  "refundTerms" TEXT,
  "integrityWarnings" JSONB,
  "issuedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "refusedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeContract_missionId_key" ON "OutcomeContract"("missionId");
CREATE INDEX "OutcomeContract_status_createdAt_idx" ON "OutcomeContract"("status", "createdAt");

CREATE TABLE "OutcomePlan" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "graph" JSONB NOT NULL,
  "checkpoint" JSONB,
  "resumeToken" TEXT,
  "estimatedMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomePlan_missionId_key" ON "OutcomePlan"("missionId");

CREATE TABLE "OutcomeTask" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "OutcomeTaskStatus" NOT NULL DEFAULT 'PENDING',
  "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "agentKey" TEXT,
  "parallelGroup" TEXT,
  "requiresHuman" BOOLEAN NOT NULL DEFAULT false,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeTask_missionId_key_key" ON "OutcomeTask"("missionId", "key");
CREATE INDEX "OutcomeTask_missionId_status_idx" ON "OutcomeTask"("missionId", "status");

CREATE TABLE "OutcomeAgent" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "tools" JSONB NOT NULL,
  "permissions" JSONB NOT NULL,
  "allowedSources" JSONB NOT NULL,
  "costPerTaskCents" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "successRateBps" INTEGER NOT NULL DEFAULT 0,
  "confidenceLevel" TEXT NOT NULL DEFAULT 'medium',
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeAgent_key_key" ON "OutcomeAgent"("key");

CREATE TABLE "OutcomeAgentAssignment" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'executor',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeAgentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeAgentAssignment_taskId_agentId_key" ON "OutcomeAgentAssignment"("taskId", "agentId");
CREATE INDEX "OutcomeAgentAssignment_missionId_idx" ON "OutcomeAgentAssignment"("missionId");

CREATE TABLE "OutcomeAgentJournal" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "missionId" TEXT,
  "actorId" TEXT,
  "event" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeAgentJournal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeAgentJournal_agentId_createdAt_idx" ON "OutcomeAgentJournal"("agentId", "createdAt");

CREATE TABLE "OutcomeApproval" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "actorId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "OutcomeApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeApproval_missionId_status_idx" ON "OutcomeApproval"("missionId", "status");

CREATE TABLE "OutcomeEvidence" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "kind" "OutcomeEvidenceKind" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "payload" JSONB NOT NULL,
  "checksum" TEXT,
  "invented" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeEvidence_missionId_kind_idx" ON "OutcomeEvidence"("missionId", "kind");

CREATE TABLE "OutcomeDeliverable" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" "OutcomeDeliverableStatus" NOT NULL DEFAULT 'DRAFT',
  "content" JSONB,
  "objectKey" TEXT,
  "checksum" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutcomeDeliverable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeDeliverable_missionId_key_key" ON "OutcomeDeliverable"("missionId", "key");
CREATE INDEX "OutcomeDeliverable_missionId_status_idx" ON "OutcomeDeliverable"("missionId", "status");

CREATE TABLE "OutcomeQualityCheck" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "verdict" "OutcomeQualityVerdict" NOT NULL DEFAULT 'PENDING',
  "details" JSONB,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeQualityCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeQualityCheck_missionId_key_key" ON "OutcomeQualityCheck"("missionId", "key");
CREATE INDEX "OutcomeQualityCheck_missionId_verdict_idx" ON "OutcomeQualityCheck"("missionId", "verdict");

CREATE TABLE "OutcomeRevision" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "scope" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "OutcomeRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeRevision_missionId_status_idx" ON "OutcomeRevision"("missionId", "status");

CREATE TABLE "OutcomeAcceptance" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "decision" "OutcomeAcceptanceDecision" NOT NULL,
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeAcceptance_missionId_key" ON "OutcomeAcceptance"("missionId");

CREATE TABLE "OutcomeCost" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "kind" "OutcomeCostKind" NOT NULL,
  "label" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "invoiceId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeCost_missionId_kind_idx" ON "OutcomeCost"("missionId", "kind");

CREATE TABLE "OutcomeMilestone" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "unlockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutcomeMilestone_missionId_key_key" ON "OutcomeMilestone"("missionId", "key");

CREATE TABLE "OutcomeStatusTransition" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "fromStatus" "OutcomeMissionStatus" NOT NULL,
  "toStatus" "OutcomeMissionStatus" NOT NULL,
  "reason" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OutcomeStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutcomeStatusTransition_missionId_createdAt_idx" ON "OutcomeStatusTransition"("missionId", "createdAt");

-- Foreign keys
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_outcomeMissionId_fkey" FOREIGN KEY ("outcomeMissionId") REFERENCES "OutcomeMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_outcomeMissionId_fkey" FOREIGN KEY ("outcomeMissionId") REFERENCES "OutcomeMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_outcomeMissionId_fkey" FOREIGN KEY ("outcomeMissionId") REFERENCES "OutcomeMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_outcomeMissionId_fkey" FOREIGN KEY ("outcomeMissionId") REFERENCES "OutcomeMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutcomeMission" ADD CONSTRAINT "OutcomeMission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeMission" ADD CONSTRAINT "OutcomeMission_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutcomeMission" ADD CONSTRAINT "OutcomeMission_packId_fkey" FOREIGN KEY ("packId") REFERENCES "OutcomePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutcomeMissionSource" ADD CONSTRAINT "OutcomeMissionSource_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeMissionSource" ADD CONSTRAINT "OutcomeMissionSource_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutcomeContract" ADD CONSTRAINT "OutcomeContract_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomePlan" ADD CONSTRAINT "OutcomePlan_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeTask" ADD CONSTRAINT "OutcomeTask_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutcomeAgentAssignment" ADD CONSTRAINT "OutcomeAgentAssignment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeAgentAssignment" ADD CONSTRAINT "OutcomeAgentAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OutcomeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeAgentAssignment" ADD CONSTRAINT "OutcomeAgentAssignment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "OutcomeAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutcomeAgentJournal" ADD CONSTRAINT "OutcomeAgentJournal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "OutcomeAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeAgentJournal" ADD CONSTRAINT "OutcomeAgentJournal_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutcomeApproval" ADD CONSTRAINT "OutcomeApproval_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeApproval" ADD CONSTRAINT "OutcomeApproval_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutcomeEvidence" ADD CONSTRAINT "OutcomeEvidence_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeDeliverable" ADD CONSTRAINT "OutcomeDeliverable_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeQualityCheck" ADD CONSTRAINT "OutcomeQualityCheck_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutcomeRevision" ADD CONSTRAINT "OutcomeRevision_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeRevision" ADD CONSTRAINT "OutcomeRevision_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutcomeAcceptance" ADD CONSTRAINT "OutcomeAcceptance_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeAcceptance" ADD CONSTRAINT "OutcomeAcceptance_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutcomeCost" ADD CONSTRAINT "OutcomeCost_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeMilestone" ADD CONSTRAINT "OutcomeMilestone_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeStatusTransition" ADD CONSTRAINT "OutcomeStatusTransition_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "OutcomeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
