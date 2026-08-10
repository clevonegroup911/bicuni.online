-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('UNIVERSITY', 'HIGHER_INSTITUTE', 'RESEARCH_CENTER', 'SCHOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable: extend University (Institutions) without dropping existing rows
ALTER TABLE "University" ADD COLUMN "acronym" TEXT,
ADD COLUMN "type" "InstitutionType" NOT NULL DEFAULT 'UNIVERSITY',
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "University_status_type_country_idx" ON "University"("status", "type", "country");

-- CreateIndex
CREATE INDEX "University_createdAt_idx" ON "University"("createdAt");
