import type { Prisma } from "@prisma/client";
import { db } from "../db/client";
import { canArchiveDocument, canReviewDocument, toDocumentResource, type DocumentActor } from "@/lib/documents/permissions";
import { DocumentDomainError } from "@/lib/documents/document-service";
import { internalDoiForApproval } from "@/lib/documents/doi";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { isDocumentInAdminScope, managedDocumentInstitutionIds } from "@/lib/documents/scope";
import { logger } from "../observability/logger";

const ARCHIVE_FROM_STATUSES = ["APPROVED", "PUBLISHED"] as const;

async function assertReviewScope(actor: DocumentActor, document: { universityId: string | null }) {
  const scope = await managedDocumentInstitutionIds(actor.id, actor.role);
  if (isDocumentInAdminScope(document, scope)) return;
  if (actor.role === "UNIVERSITY_ADMIN" || actor.role === "INSTITUTION_ADMIN") {
    if (!document.universityId) {
      throw new DocumentDomainError("Un dépôt sans université doit être validé par un super administrateur.", 403);
    }
    throw new DocumentDomainError("Ce document ne relève pas de votre université.", 403);
  }
  throw new DocumentDomainError("Validation refusée.", 403);
}

export class ReviewService {
  async review(id: string, actor: DocumentActor, input: { decision: "APPROVED" | "REJECTED"; comment?: string }) {
    if (!canReviewDocument(actor)) throw new DocumentDomainError("Validation refusée.", 403);
    return db.$transaction((tx) => this.reviewInTransaction(tx, id, actor, input));
  }

  async reviewInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    actor: DocumentActor,
    input: { decision: "APPROVED" | "REJECTED"; comment?: string },
  ) {
    if (!canReviewDocument(actor)) throw new DocumentDomainError("Validation refusée.", 403);
    const document = await tx.document.findUnique({ where: { id } });
    if (!document) throw new DocumentDomainError("Document introuvable.", 404);
    if (document.status !== "PENDING_REVIEW") throw new DocumentDomainError("Seul un document en attente peut être validé.");
    await assertReviewScope(actor, document);
    if (input.decision === "REJECTED" && !input.comment?.trim()) {
      throw new DocumentDomainError("Un motif de rejet est obligatoire.");
    }

    const publishedAt = input.decision === "APPROVED" ? new Date() : null;
    const transition = await tx.document.updateMany({
      where: { id, status: "PENDING_REVIEW" },
      data: { status: input.decision, publishedAt },
    });
    if (transition.count !== 1) {
      throw new DocumentDomainError("Cette transition n’est plus possible : le document a déjà changé de statut.", 409);
    }

    await tx.review.create({
      data: { documentId: id, reviewerId: actor.id, decision: input.decision, comment: input.comment },
    });
    await tx.documentHistory.create({
      data: {
        documentId: id,
        actorId: actor.id,
        action: input.decision,
        fromStatus: "PENDING_REVIEW",
        toStatus: input.decision,
        version: document.currentVersion,
        comment: input.comment,
      },
    });

    if (input.decision === "APPROVED") {
      const existingPublication = await tx.publication.findUnique({ where: { documentId: id } });
      const internalDoi = internalDoiForApproval(existingPublication?.internalDoi);
      await tx.publication.upsert({
        where: { documentId: id },
        update: { publishedAt: publishedAt!, internalDoi },
        create: {
          documentId: id,
          publisherId: actor.id,
          internalDoi: null,
          publishedAt: publishedAt!,
        },
      });
      await new PersistentIdentifierService().ensureForPublishedDocument(tx, {
        id: document.id,
        type: document.type,
      }, actor.id);
    }

    logger.info("document.transition", {
      documentId: id,
      actorId: actor.id,
      fromStatus: "PENDING_REVIEW",
      toStatus: input.decision,
    });
    const result = await tx.document.findUnique({ where: { id } });
    if (!result) throw new DocumentDomainError("Document introuvable.", 404);
    return result;
  }

  async archive(id: string, actor: DocumentActor) {
    return db.$transaction((tx) => this.archiveInTransaction(tx, id, actor));
  }

  async archiveInTransaction(tx: Prisma.TransactionClient, id: string, actor: DocumentActor) {
    const document = await tx.document.findUnique({ where: { id } });
    if (!document) throw new DocumentDomainError("Document introuvable.", 404);
    if (!canArchiveDocument(actor, toDocumentResource(document))) {
      throw new DocumentDomainError("Archivage refusé.", 403);
    }
    await assertReviewScope(actor, document);

    const transition = await tx.document.updateMany({
      where: { id, status: { in: [...ARCHIVE_FROM_STATUSES] } },
      data: { status: "ARCHIVED" },
    });
    if (transition.count !== 1) {
      throw new DocumentDomainError("Cette transition n’est plus possible : le document a déjà changé de statut.", 409);
    }

    await tx.documentHistory.create({
      data: {
        documentId: id,
        actorId: actor.id,
        action: "ARCHIVED",
        fromStatus: document.status,
        toStatus: "ARCHIVED",
        version: document.currentVersion,
      },
    });
    logger.info("document.transition", {
      documentId: id,
      actorId: actor.id,
      fromStatus: document.status,
      toStatus: "ARCHIVED",
    });
    const result = await tx.document.findUnique({ where: { id } });
    if (!result) throw new DocumentDomainError("Document introuvable.", 404);
    return result;
  }
}
