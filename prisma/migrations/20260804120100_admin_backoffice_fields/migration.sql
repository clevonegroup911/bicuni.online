CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'DELETED');

-- Existing accounts remain active; only newly created public accounts use PENDING.
ALTER TABLE "User"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

ALTER TABLE "AuditLog"
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "oldValue" JSONB,
  ADD COLUMN "newValue" JSONB;

CREATE INDEX "User_role_status_createdAt_idx" ON "User"("role", "status", "createdAt");
