import type { FileScanStatus, Role } from "@prisma/client";

export function isCleanUploadedFile(file: { isUploaded: boolean; scanStatus: FileScanStatus }) {
  return file.isUploaded === true && file.scanStatus === "CLEAN";
}

export function maxUploadBytes() {
  return Number(process.env.DOCUMENT_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
}

export function canConfirmDocumentFile(
  actor: { id: string; role: Role },
  document: { authorId: string },
) {
  return document.authorId === actor.id || actor.role === "SUPER_ADMIN";
}
