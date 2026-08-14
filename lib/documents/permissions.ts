import type { DocumentStatus, Role } from "@prisma/client";

export type DocumentActor = { id: string; role: Role };
export type DocumentResource = { authorId: string; status: DocumentStatus; universityId?: string | null };

export function toDocumentResource(document: {
  authorId: string;
  status: DocumentStatus;
  universityId?: string | null;
}): DocumentResource {
  return { authorId: document.authorId, status: document.status, universityId: document.universityId };
}

const GLOBAL_DOCUMENT_ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];
const INSTITUTION_DOCUMENT_ROLES: Role[] = ["INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"];

export function canManageDocumentsGlobally(role: Role) {
  return GLOBAL_DOCUMENT_ADMIN_ROLES.includes(role);
}

export function isInstitutionScopedDocumentRole(role: Role) {
  return INSTITUTION_DOCUMENT_ROLES.includes(role);
}

export const canCreateDocument = (actor: DocumentActor) => ["USER", "STUDENT", "RESEARCHER", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN", "SUPER_ADMIN"].includes(actor.role);
export const canEditDocument = (actor: DocumentActor, document: DocumentResource) => actor.role === "SUPER_ADMIN" || (document.authorId === actor.id && document.status === "DRAFT");
export const canDeleteDocument = canEditDocument;
export const canSubmitDocument = (actor: DocumentActor, document: DocumentResource) => document.authorId === actor.id && document.status === "DRAFT";
export const canReviewDocument = (actor: DocumentActor) => ["MODERATOR", "ADMIN", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN", "SUPER_ADMIN"].includes(actor.role);
export const canArchiveDocument = (actor: DocumentActor, document: DocumentResource) => {
  if (!["APPROVED", "PUBLISHED"].includes(document.status)) return false;
  return actor.role === "SUPER_ADMIN" || ["ADMIN", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"].includes(actor.role);
};

export function canReadDocument(
  actor: DocumentActor | null,
  document: DocumentResource,
  managedInstitutionIds?: string[] | null,
) {
  if (["APPROVED", "PUBLISHED"].includes(document.status)) return true;
  if (!actor) return false;
  if (actor.id === document.authorId) return true;
  if (!canReviewDocument(actor)) return false;
  if (canManageDocumentsGlobally(actor.role)) return true;
  if (!isInstitutionScopedDocumentRole(actor.role)) return false;
  if (managedInstitutionIds === undefined) return false;
  if (managedInstitutionIds === null) return true;
  return Boolean(document.universityId && managedInstitutionIds.includes(document.universityId));
}
