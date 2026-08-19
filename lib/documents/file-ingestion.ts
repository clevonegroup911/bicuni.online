import type { FileScanStatus, Role } from "@prisma/client";
import { db } from "@/lib/db/client";
import { antivirusScanner, type AntivirusScanner } from "@/lib/documents/antivirus-scanner";
import { canConfirmDocumentFile, isCleanUploadedFile, maxUploadBytes } from "@/lib/documents/file-scan";
import { privateStorage, type StorageProvider } from "@/lib/storage";
import { logger } from "@/lib/observability/logger";

export class FileIngestionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type ConfirmResult = {
  confirmed: boolean;
  fileId: string;
  scanStatus: FileScanStatus;
  sizeBytes: number;
  checksum: string;
};

export async function confirmStoredDocumentFile(input: {
  fileId: string;
  actor: { id: string; role: Role };
  payload?: Record<string, unknown> | null;
}, deps: { storage?: StorageProvider; scanner?: AntivirusScanner } = {}): Promise<ConfirmResult> {
  if (input.payload && "isUploaded" in input.payload) {
    logger.warn("document.upload_isUploaded_ignored", { fileId: input.fileId, actorId: input.actor.id });
  }

  const file = await db.documentFile.findUnique({ where: { id: input.fileId }, include: { document: true } });
  if (!file) throw new FileIngestionError("Fichier introuvable.", 404);
  if (!canConfirmDocumentFile(input.actor, file.document)) throw new FileIngestionError("Accès refusé.", 403);
  if (file.scanStatus === "REJECTED") throw new FileIngestionError("Fichier rejeté.", 422);
  if (isCleanUploadedFile(file)) {
    return { confirmed: true, fileId: file.id, scanStatus: file.scanStatus, sizeBytes: file.sizeBytes, checksum: file.checksum };
  }

  const storage = deps.storage ?? privateStorage();
  const digest = await storage.digest(file.objectKey);
  if (!digest.exists || digest.sizeBytes == null || !digest.checksum) {
    throw new FileIngestionError("Le fichier stocké est introuvable.", 422);
  }
  if (digest.contentType && digest.contentType !== file.mimeType) {
    await rejectFile(file.id, digest.sizeBytes, digest.checksum);
    throw new FileIngestionError("Le type du fichier stocké ne correspond pas.", 422);
  }
  if (digest.sizeBytes > maxUploadBytes()) {
    await rejectFile(file.id, digest.sizeBytes, digest.checksum);
    throw new FileIngestionError("Le fichier stocké dépasse la taille autorisée.", 422);
  }
  if (digest.sizeBytes !== file.sizeBytes || digest.checksum.toLowerCase() !== file.checksum.toLowerCase()) {
    await rejectFile(file.id, digest.sizeBytes, digest.checksum);
    throw new FileIngestionError("L’intégrité du fichier ne correspond pas aux métadonnées annoncées.", 422);
  }

  await db.documentFile.update({
    where: { id: file.id },
    data: {
      isUploaded: true,
      sizeBytes: digest.sizeBytes,
      checksum: digest.checksum,
      scanStatus: "SCANNING",
      scannedAt: null,
    },
  });

  const scanner = deps.scanner ?? antivirusScanner();
  const scan = await scanner.scan({
    objectKey: file.objectKey,
    checksum: digest.checksum,
    sizeBytes: digest.sizeBytes,
    mimeType: file.mimeType,
  });

  const scanStatus: FileScanStatus = scan.verdict === "clean"
    ? "CLEAN"
    : scan.verdict === "rejected"
      ? "REJECTED"
      : "PENDING";

  await db.documentFile.update({
    where: { id: file.id },
    data: {
      isUploaded: true,
      sizeBytes: digest.sizeBytes,
      checksum: digest.checksum,
      scanStatus,
      scannedAt: scanStatus === "PENDING" ? null : new Date(),
    },
  });

  if (scanStatus === "REJECTED") {
    throw new FileIngestionError("Le fichier a été rejeté par l’analyse.", 422);
  }

  return {
    confirmed: scanStatus === "CLEAN",
    fileId: file.id,
    scanStatus,
    sizeBytes: digest.sizeBytes,
    checksum: digest.checksum,
  };
}

async function rejectFile(fileId: string, sizeBytes: number, checksum: string) {
  await db.documentFile.update({
    where: { id: fileId },
    data: { isUploaded: true, sizeBytes, checksum, scanStatus: "REJECTED", scannedAt: new Date() },
  });
}
