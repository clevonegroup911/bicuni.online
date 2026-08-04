import { db } from "@/lib/db/client";
import { canArchiveDocument, canReviewDocument, type DocumentActor } from "@/lib/documents/permissions";
import { DocumentDomainError } from "@/lib/documents/document-service";
import { logger } from "@/lib/observability/logger";

export class ReviewService {
  async review(id: string, actor: DocumentActor, input: { decision: "APPROVED" | "REJECTED"; comment?: string }) {
    if (!canReviewDocument(actor)) throw new DocumentDomainError("Validation refusée.", 403);
    const document = await db.document.findUnique({ where: { id } });
    if (!document) throw new DocumentDomainError("Document introuvable.", 404);
    if (document.status !== "PENDING_REVIEW") throw new DocumentDomainError("Seul un document en attente peut être validé.");
    if (actor.role === "UNIVERSITY_ADMIN" || actor.role === "INSTITUTION_ADMIN") {
      if (!document.universityId) throw new DocumentDomainError("Un dépôt sans université doit être validé par un super administrateur.", 403);
      const mandate = await db.university.count({ where: { id: document.universityId, admins: { some: { id: actor.id } } } });
      if (!mandate) throw new DocumentDomainError("Ce document ne relève pas de votre université.", 403);
    }
    if (input.decision === "REJECTED" && !input.comment) throw new DocumentDomainError("Un motif de rejet est obligatoire.");
    const publishedAt = input.decision === "APPROVED" ? new Date() : null;
    return db.$transaction(async (tx) => {
      await tx.review.create({ data: { documentId: id, reviewerId: actor.id, decision: input.decision, comment: input.comment } });
      const result = await tx.document.update({ where: { id }, data: { status: input.decision, publishedAt, history: { create: { actorId: actor.id, action: input.decision, fromStatus: "PENDING_REVIEW", toStatus: input.decision, version: document.currentVersion, comment: input.comment } } } });
      if (input.decision === "APPROVED") await tx.publication.upsert({ where: { documentId: id }, update: { publishedAt: publishedAt! }, create: { documentId: id, publisherId: actor.id, internalDoi: internalDoi(id), publishedAt: publishedAt! } });
      logger.info("document.transition", { documentId: id, actorId: actor.id, fromStatus: "PENDING_REVIEW", toStatus: input.decision });
      return result;
    });
  }

  async archive(id: string, actor: DocumentActor) {
    const document = await db.document.findUnique({ where: { id } });
    if (!document) throw new DocumentDomainError("Document introuvable.", 404);
    if (!canArchiveDocument(actor, document)) throw new DocumentDomainError("Archivage refusé.", 403);
    const result = await db.document.update({ where: { id }, data: { status: "ARCHIVED", history: { create: { actorId: actor.id, action: "ARCHIVED", fromStatus: document.status, toStatus: "ARCHIVED", version: document.currentVersion } } } });
    logger.info("document.transition", { documentId: id, actorId: actor.id, fromStatus: document.status, toStatus: "ARCHIVED" });
    return result;
  }
}

function internalDoi(id: string) { return `10.87878/bicuni.${id}`; }
