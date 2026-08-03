import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import type { DocumentActor } from "@/lib/documents/permissions";
import { canCreateDocument, canDeleteDocument, canEditDocument, canSubmitDocument } from "@/lib/documents/permissions";
import type { documentMetadataSchema } from "@/lib/validators/document";
import type { z } from "zod";
import { logger } from "@/lib/observability/logger";

export class DocumentDomainError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const documentInclude = {
  author: { select: { id: true, name: true } }, university: true, faculty: true, department: true,
  category: true, tags: true, files: { orderBy: { version: "desc" as const } }, publication: true,
  _count: { select: { favorites: true, comments: true } },
} satisfies Prisma.DocumentInclude;

export class DocumentService {
  async listPublic(input: { page: number; pageSize: number; query?: string }) {
    const where: Prisma.DocumentWhereInput = {
      status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null,
      ...(input.query ? { OR: [{ title: { contains: input.query, mode: "insensitive" } }, { abstract: { contains: input.query, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await db.$transaction([
      db.document.findMany({ where, include: documentInclude, orderBy: { publishedAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      db.document.count({ where }),
    ]);
    return { items, total, page: input.page, pageSize: input.pageSize };
  }

  async update(id: string, actor: DocumentActor, data: z.infer<typeof documentMetadataSchema> | Partial<z.infer<typeof documentMetadataSchema>>) {
    const current = await db.document.findUnique({ where: { id } });
    if (!current) throw new DocumentDomainError("Document introuvable.", 404);
    if (!canEditDocument(actor, current)) throw new DocumentDomainError("Seul un brouillon vous appartenant peut être modifié.", 403);
    const { keywords, ...metadata } = data;
    return db.document.update({ where: { id }, data: {
      ...metadata,
      ...(keywords ? { tags: { set: [], connectOrCreate: keywords.map((name) => ({ where: { slug: slugify(name) }, create: { name, slug: slugify(name) } })) } } : {}),
      history: { create: { actorId: actor.id, action: "METADATA_UPDATED", version: current.currentVersion } },
    }, include: documentInclude });
  }

  async submit(id: string, actor: DocumentActor) {
    const current = await db.document.findUnique({ where: { id }, include: { files: true } });
    if (!current) throw new DocumentDomainError("Document introuvable.", 404);
    if (!canSubmitDocument(actor, current)) throw new DocumentDomainError("Ce document ne peut pas être soumis.", 403);
    if (!current.files.some((file) => file.isUploaded)) throw new DocumentDomainError("Le fichier doit être confirmé avant soumission.");
    const result = await db.document.update({ where: { id }, data: { status: "PENDING_REVIEW", history: { create: { actorId: actor.id, action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", version: current.currentVersion } } } });
    logger.info("document.transition", { documentId: id, actorId: actor.id, fromStatus: "DRAFT", toStatus: "PENDING_REVIEW" });
    return result;
  }

  async softDelete(id: string, actor: DocumentActor) {
    const current = await db.document.findUnique({ where: { id } });
    if (!current) return;
    if (!canDeleteDocument(actor, current)) throw new DocumentDomainError("Suppression refusée.", 403);
    await db.document.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date(), history: { create: { actorId: actor.id, action: "DELETED", fromStatus: current.status, toStatus: "DELETED", version: current.currentVersion } } } });
    logger.info("document.transition", { documentId: id, actorId: actor.id, fromStatus: current.status, toStatus: "DELETED" });
  }
}

export function assertCanCreate(actor: DocumentActor) {
  if (!canCreateDocument(actor)) throw new DocumentDomainError("Création refusée.", 403);
}
export function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80); }
