import { Prisma, type Role } from "@prisma/client";
import { can } from "../auth/rbac";
import { db } from "../db/client";
import { registeredDoi } from "../documents/doi";
import { canArchiveDocument, canReviewDocument, toDocumentResource } from "../documents/permissions";
import { ReviewService } from "../documents/review-service";
import { isDocumentInAdminScope, managedDocumentInstitutionIds } from "../documents/scope";
import type { AdminDocumentQuery } from "./validators";

export class AdminDocumentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type AuditContext = { ipHash: string | null; userAgent: string | null };

export const DOCUMENT_LIST_ORDER = [{ updatedAt: "desc" as const }, { id: "desc" as const }];

const FILE_PUBLIC_SELECT = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  version: true,
  isUploaded: true,
  createdAt: true,
} satisfies Prisma.DocumentFileSelect;

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

export function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "—";
  if (sizeBytes < 1024) return `${sizeBytes} o`;
  const kilobytes = sizeBytes / 1024;
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} Ko`;
  const megabytes = kilobytes / 1024;
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} Mo`;
}

export class AdminDocumentService {
  async managedScope(actorId: string, actorRole: Role) {
    if (!can(actorRole, "admin:documents:review")) {
      throw new AdminDocumentError("Permission documentaire insuffisante.", 403);
    }
    return managedDocumentInstitutionIds(actorId, actorRole);
  }

  private scopedWhere(scope: string[] | null, institutionId?: string): Prisma.DocumentWhereInput | null {
    if (scope && scope.length === 0) return null;
    if (institutionId) {
      if (scope && !scope.includes(institutionId)) return null;
      return { universityId: institutionId };
    }
    if (scope) return { universityId: { in: scope } };
    return {};
  }

  private async loadInScope(actorId: string, actorRole: Role, id: string) {
    const scope = await this.managedScope(actorId, actorRole);
    const document = await db.document.findUnique({
      where: { id },
      select: { id: true, universityId: true, status: true, deletedAt: true, currentVersion: true },
    });
    if (!document || document.deletedAt || document.status === "DELETED") {
      throw new AdminDocumentError("Document introuvable.", 404);
    }
    if (!isDocumentInAdminScope(document, scope)) {
      throw new AdminDocumentError("Document introuvable.", 404);
    }
    return document;
  }

  async statistics(actorId: string, actorRole: Role) {
    const scope = await this.managedScope(actorId, actorRole);
    const institutionWhere = this.scopedWhere(scope);
    if (institutionWhere === null) {
      return { pending: 0, approved: 0, published: 0, rejected: 0, archived: 0 };
    }
    const base: Prisma.DocumentWhereInput = {
      deletedAt: null,
      status: { not: "DELETED" },
      ...institutionWhere,
    };
    const [pending, approved, published, rejected, archived] = await Promise.all([
      db.document.count({ where: { ...base, status: "PENDING_REVIEW" } }),
      db.document.count({ where: { ...base, status: "APPROVED" } }),
      db.document.count({ where: { ...base, status: "PUBLISHED" } }),
      db.document.count({ where: { ...base, status: "REJECTED" } }),
      db.document.count({ where: { ...base, status: "ARCHIVED" } }),
    ]);
    return { pending, approved, published, rejected, archived };
  }

  async listFilterInstitutions(actorId: string, actorRole: Role) {
    const scope = await this.managedScope(actorId, actorRole);
    if (scope && scope.length === 0) return [];
    return db.university.findMany({
      where: scope ? { id: { in: scope } } : {},
      select: { id: true, name: true, acronym: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 500,
    });
  }

  async list(input: AdminDocumentQuery & { actorId: string; actorRole: Role }) {
    const pageSize = input.limit;
    const scope = await this.managedScope(input.actorId, input.actorRole);
    const institutionWhere = this.scopedWhere(scope, input.institutionId);
    if (institutionWhere === null) {
      return { documents: [], total: 0, page: input.page, pageSize };
    }

    const updatedAt = dateRange(input.from, input.to);
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      status: { not: "DELETED" },
      ...institutionWhere,
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(input.q
        ? {
            OR: [
              { title: { contains: input.q, mode: "insensitive" } },
              { author: { name: { contains: input.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [documents, total] = await db.$transaction([
      db.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true } },
          university: { select: { id: true, name: true, acronym: true } },
        },
        orderBy: DOCUMENT_LIST_ORDER,
        skip: (input.page - 1) * pageSize,
        take: pageSize,
      }),
      db.document.count({ where }),
    ]);

    return { documents, total, page: input.page, pageSize };
  }

  async getById(actorId: string, actorRole: Role, id: string) {
    await this.loadInScope(actorId, actorRole, id);
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        abstract: true,
        language: true,
        type: true,
        license: true,
        promotion: true,
        academicYear: true,
        year: true,
        status: true,
        currentVersion: true,
        authorId: true,
        viewCount: true,
        downloadCount: true,
        favoriteCount: true,
        commentCount: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true, email: true } },
        university: { select: { id: true, name: true, acronym: true } },
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        files: { select: FILE_PUBLIC_SELECT, orderBy: [{ version: "desc" }, { id: "desc" }] },
        publication: { select: { internalDoi: true, publishedAt: true } },
        reviews: {
          select: {
            id: true,
            decision: true,
            comment: true,
            createdAt: true,
            reviewer: { select: { name: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
        history: {
          select: {
            id: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            version: true,
            comment: true,
            createdAt: true,
            actor: { select: { name: true, email: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
      },
    });
    if (!document) throw new AdminDocumentError("Document introuvable.", 404);

    const rejection = document.reviews.find((item) => item.decision === "REJECTED");
    const resource = toDocumentResource({ authorId: document.authorId, status: document.status });
    return {
      ...document,
      doi: registeredDoi(document.publication?.internalDoi),
      publication: document.publication
        ? { publishedAt: document.publication.publishedAt, doi: registeredDoi(document.publication.internalDoi) }
        : null,
      rejectionReason: rejection?.comment ?? null,
      canReview: canReviewDocument({ id: actorId, role: actorRole }) && document.status === "PENDING_REVIEW",
      canArchive: canArchiveDocument({ id: actorId, role: actorRole }, resource),
    };
  }

  async review(
    actorId: string,
    actorRole: Role,
    id: string,
    input: { decision: "APPROVED" | "REJECTED"; comment?: string },
    context: AuditContext,
  ) {
    await this.loadInScope(actorId, actorRole, id);
    return db.$transaction(async (tx) => {
      const result = await new ReviewService().reviewInTransaction(tx, id, { id: actorId, role: actorRole }, input);
      await tx.auditLog.create({
        data: {
          actorId,
          action: input.decision === "APPROVED" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
          entityType: "Document",
          entityId: id,
          oldValue: { status: "PENDING_REVIEW" },
          newValue: { status: input.decision },
          payload: input.comment ? { comment: input.comment } : undefined,
          ...context,
        },
      });
      return result;
    });
  }

  async archive(actorId: string, actorRole: Role, id: string, context: AuditContext) {
    const current = await this.loadInScope(actorId, actorRole, id);
    return db.$transaction(async (tx) => {
      const result = await new ReviewService().archiveInTransaction(tx, id, { id: actorId, role: actorRole });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "DOCUMENT_ARCHIVED",
          entityType: "Document",
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: "ARCHIVED" },
          ...context,
        },
      });
      return result;
    });
  }
}
