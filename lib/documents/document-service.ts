import type { DocumentType, Prisma } from "@prisma/client";
import { db } from "../db/client";
import type { DocumentActor } from "@/lib/documents/permissions";
import { canCreateDocument, canDeleteDocument, canEditDocument, canSubmitDocument } from "@/lib/documents/permissions";
import { registeredDoi } from "@/lib/documents/doi";
import { isCleanUploadedFile } from "@/lib/documents/file-scan";
import type { documentMetadataSchema } from "@/lib/validators/document";
import type { z } from "zod";
import { logger } from "../observability/logger";

export class DocumentDomainError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const documentFilePublicSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  version: true,
  isUploaded: true,
  scanStatus: true,
  createdAt: true,
} satisfies Prisma.DocumentFileSelect;

export const documentInclude = {
  author: { select: { id: true, name: true } }, university: true, faculty: true, department: true,
  category: true, tags: true, files: { select: documentFilePublicSelect, orderBy: { version: "desc" as const } }, publication: true,
  _count: { select: { favorites: true, comments: true } },
} satisfies Prisma.DocumentInclude;

export class DocumentService {
  async listPublic(input: {
    page: number;
    pageSize: number;
    query?: string;
    category?: string;
    type?: DocumentType;
    university?: string;
    year?: number;
    sort?: "recent" | "views";
  }) {
    const where: Prisma.DocumentWhereInput = {
      status: { in: ["APPROVED", "PUBLISHED"] },
      deletedAt: null,
      ...(input.query ? { OR: [{ title: { contains: input.query, mode: "insensitive" } }, { abstract: { contains: input.query, mode: "insensitive" } }] } : {}),
      ...(input.category ? { category: { name: { equals: input.category, mode: "insensitive" } } } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.university ? { university: { name: { equals: input.university, mode: "insensitive" } } } : {}),
      ...(input.year ? { year: input.year } : {}),
    };
    const [items, total] = await db.$transaction([
      db.document.findMany({
        where,
        include: documentInclude,
        orderBy: input.sort === "views" ? { viewCount: "desc" } : { publishedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      db.document.count({ where }),
    ]);
    return {
      items: items.map((item) => sanitizeDocumentForClient({
        ...item,
        files: item.files.filter(isCleanUploadedFile),
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async update(id: string, actor: DocumentActor, data: z.infer<typeof documentMetadataSchema> | Partial<z.infer<typeof documentMetadataSchema>>) {
    const current = await db.document.findUnique({ where: { id } });
    if (!current) throw new DocumentDomainError("Document introuvable.", 404);
    if (!canEditDocument(actor, current)) throw new DocumentDomainError("Seul un brouillon vous appartenant peut être modifié.", 403);
    await assertInstitutionHierarchy({
      universityId: data.universityId === undefined ? current.universityId : data.universityId,
      facultyId: data.facultyId === undefined ? current.facultyId : data.facultyId,
      departmentId: data.departmentId === undefined ? current.departmentId : data.departmentId,
    });
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
    if (!current.files.some(isCleanUploadedFile)) throw new DocumentDomainError("Un fichier analysé et propre est requis avant soumission.");
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

export async function assertInstitutionHierarchy(input: {
  universityId?: string | null;
  facultyId?: string | null;
  departmentId?: string | null;
}) {
  if (input.facultyId && !input.universityId) {
    throw new DocumentDomainError("Une faculté doit appartenir à une université sélectionnée.");
  }
  if (input.departmentId && !input.facultyId) {
    throw new DocumentDomainError("Un département doit appartenir à une faculté sélectionnée.");
  }
  if (!input.universityId) return;

  const university = await db.university.findUnique({
    where: { id: input.universityId },
    select: { id: true, status: true },
  });
  if (!university || university.status !== "ACTIVE") {
    throw new DocumentDomainError("Université inconnue ou inactive.");
  }
  if (!input.facultyId) return;

  const faculty = await db.faculty.findUnique({
    where: { id: input.facultyId },
    select: { universityId: true },
  });
  if (!faculty || faculty.universityId !== input.universityId) {
    throw new DocumentDomainError("La faculté ne correspond pas à l’université sélectionnée.");
  }
  if (!input.departmentId) return;

  const department = await db.department.findUnique({
    where: { id: input.departmentId },
    select: { facultyId: true },
  });
  if (!department || department.facultyId !== input.facultyId) {
    throw new DocumentDomainError("Le département ne correspond pas à la faculté sélectionnée.");
  }
}
export function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80); }

export function sanitizeDocumentForClient<T extends {
  files?: Array<Record<string, unknown>>;
  publication?: { internalDoi: string | null } | null;
}>(document: T): T {
  const publicFields = Object.fromEntries(
    Object.entries(document).filter(([key]) => key !== "thumbnailObjectKey" && key !== "files" && key !== "publication"),
  );
  return {
    ...publicFields,
    files: document.files?.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      version: file.version,
      isUploaded: file.isUploaded,
      scanStatus: file.scanStatus,
      createdAt: file.createdAt,
    })),
    publication: document.publication
      ? { ...document.publication, internalDoi: registeredDoi(document.publication.internalDoi) }
      : document.publication,
  } as T;
}
