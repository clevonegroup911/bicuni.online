-- AlterTable
ALTER TABLE "DocumentFile" ALTER COLUMN "isUploaded" SET DEFAULT false;

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'REJECTED');

-- AlterTable
ALTER TABLE "DocumentFile" ADD COLUMN "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "DocumentFile" ADD COLUMN "scannedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DocumentFile_documentId_scanStatus_idx" ON "DocumentFile"("documentId", "scanStatus");
