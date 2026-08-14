import { PidResourceType } from "@prisma/client";
import { db } from "../db/client";
import { logger } from "../observability/logger";
import { PidBoundResourceError } from "./errors";

export const PID_BOUND_RESOURCE_DELETE_FORBIDDEN =
  "Cannot physically delete a resource referenced by a persistent identifier";

export function pidResourceIdentityWhere(resourceType: PidResourceType, resourceId: string) {
  return {
    resourceType_resourceId: {
      resourceType,
      resourceId,
    },
  };
}

export async function findDocumentPrimaryPid(documentId: string) {
  return db.persistentIdentifier.findUnique({
    where: pidResourceIdentityWhere(PidResourceType.DOCUMENT, documentId),
    select: { identifier: true, status: true },
  });
}

export async function assertResourceNotPidBound(resourceType: PidResourceType, resourceId: string) {
  const bound = await db.persistentIdentifier.findUnique({
    where: pidResourceIdentityWhere(resourceType, resourceId),
    select: { id: true },
  });
  if (!bound) return;
  logger.error("pid.bound_resource_delete_blocked", new Error(PID_BOUND_RESOURCE_DELETE_FORBIDDEN), { resourceType });
  throw new PidBoundResourceError();
}

export async function assertDocumentNotPidBound(documentId: string) {
  await assertResourceNotPidBound(PidResourceType.DOCUMENT, documentId);
}

export async function assertPublicationNotPidBound(publicationId: string) {
  await assertResourceNotPidBound(PidResourceType.PUBLICATION, publicationId);
}

export async function deleteUnboundDocument(documentId: string) {
  await assertDocumentNotPidBound(documentId);
  try {
    await db.document.delete({ where: { id: documentId } });
  } catch (error) {
    throwIfPidBoundDeleteGuard(error, PidResourceType.DOCUMENT);
    throw error;
  }
}

export async function deleteUnboundPublication(publicationId: string) {
  await assertPublicationNotPidBound(publicationId);
  try {
    await db.publication.delete({ where: { id: publicationId } });
  } catch (error) {
    throwIfPidBoundDeleteGuard(error, PidResourceType.PUBLICATION);
    throw error;
  }
}

function throwIfPidBoundDeleteGuard(error: unknown, resourceType: PidResourceType): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes(PID_BOUND_RESOURCE_DELETE_FORBIDDEN)) return;
  logger.error("pid.bound_resource_delete_blocked", error, { resourceType });
  throw new PidBoundResourceError();
}
