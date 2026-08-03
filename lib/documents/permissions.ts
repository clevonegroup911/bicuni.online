import type { DocumentStatus, Role } from "@prisma/client";

export type DocumentActor = { id: string; role: Role };
export type DocumentResource = { authorId: string; status: DocumentStatus };

export const canCreateDocument = (actor: DocumentActor) => ["STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN"].includes(actor.role);
export const canEditDocument = (actor: DocumentActor, document: DocumentResource) => actor.role === "SUPER_ADMIN" || (document.authorId === actor.id && document.status === "DRAFT");
export const canDeleteDocument = canEditDocument;
export const canSubmitDocument = (actor: DocumentActor, document: DocumentResource) => document.authorId === actor.id && document.status === "DRAFT";
export const canReviewDocument = (actor: DocumentActor) => actor.role === "UNIVERSITY_ADMIN" || actor.role === "SUPER_ADMIN";
export const canArchiveDocument = (actor: DocumentActor, document: DocumentResource) => actor.role === "SUPER_ADMIN" || (actor.role === "UNIVERSITY_ADMIN" && ["APPROVED", "PUBLISHED"].includes(document.status));
export const canReadDocument = (actor: DocumentActor | null, document: DocumentResource) => ["APPROVED", "PUBLISHED"].includes(document.status) || Boolean(actor && (actor.id === document.authorId || canReviewDocument(actor)));
