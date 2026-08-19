import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  findUnique,
  count,
  transaction,
  universityFindMany,
  auditCreate,
  reviewMock,
  archiveMock,
  reviewInTransactionMock,
  archiveInTransactionMock,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  universityFindMany: vi.fn(),
  auditCreate: vi.fn(),
  reviewMock: vi.fn(),
  archiveMock: vi.fn(),
  reviewInTransactionMock: vi.fn(),
  archiveInTransactionMock: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    document: { findMany, findUnique, count },
    university: { findMany: universityFindMany },
    auditLog: { create: auditCreate },
    $transaction: transaction,
  },
}));

vi.mock("../documents/review-service", () => ({
  ReviewService: class {
    review = reviewMock;
    archive = archiveMock;
    reviewInTransaction = reviewInTransactionMock;
    archiveInTransaction = archiveInTransactionMock;
  },
}));

import { AdminDocumentError, AdminDocumentService, DOCUMENT_LIST_ORDER } from "./document-admin-service";

const stamped = new Date("2026-01-01T00:00:00.000Z");
const context = { ipHash: "hash", userAgent: "vitest" };

function documentRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Document ${id}`,
    type: "ARTICLE",
    status: "PENDING_REVIEW",
    currentVersion: 1,
    createdAt: stamped,
    updatedAt: stamped,
    author: { id: "author-1", name: "Auteur" },
    university: { id: "uni-1", name: "Université 1", acronym: "U1" },
    ...overrides,
  };
}

describe("AdminDocumentService isolation et liste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callbackOrQueries: unknown) => {
      if (typeof callbackOrQueries === "function") {
        return (callbackOrQueries as (tx: { auditLog: { create: typeof auditCreate } }) => unknown)({
          auditLog: { create: auditCreate },
        });
      }
      return Promise.all(callbackOrQueries as Promise<unknown>[]);
    });
    auditCreate.mockResolvedValue({});
    reviewInTransactionMock.mockResolvedValue({ id: "doc-1", status: "APPROVED" });
    archiveInTransactionMock.mockResolvedValue({ id: "doc-1", status: "ARCHIVED" });
  });

  it("list() d’un INSTITUTION_ADMIN ne retourne que son institution", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    findMany.mockResolvedValue([documentRow("doc-1")]);
    count.mockResolvedValue(1);

    const result = await new AdminDocumentService().list({
      actorId: "ia",
      actorRole: "INSTITUTION_ADMIN",
      q: "",
      page: 1,
      limit: 25,
    });

    expect(result.documents.map((item) => item.id)).toEqual(["doc-1"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ universityId: { in: ["uni-1"] } }),
        orderBy: DOCUMENT_LIST_ORDER,
        skip: 0,
        take: 25,
      }),
    );
  });

  it("list() d’un INSTITUTION_ADMIN sans mandat retourne une liste vide", async () => {
    universityFindMany.mockResolvedValue([]);
    const result = await new AdminDocumentService().list({
      actorId: "ia",
      actorRole: "INSTITUTION_ADMIN",
      q: "",
      page: 1,
      limit: 25,
    });
    expect(result.documents).toEqual([]);
    expect(result.total).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("filtre institution hors périmètre sans fuite", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    const result = await new AdminDocumentService().list({
      actorId: "ia",
      actorRole: "INSTITUTION_ADMIN",
      q: "",
      page: 1,
      limit: 25,
      institutionId: "uni-2",
    });
    expect(result.documents).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("applique recherche titre/auteur et statut", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await new AdminDocumentService().list({
      actorId: "root",
      actorRole: "SUPER_ADMIN",
      q: "mémoire",
      page: 1,
      limit: 25,
      status: "PENDING_REVIEW",
      type: "MEMOIRE",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING_REVIEW",
          type: "MEMOIRE",
          OR: [
            { title: { contains: "mémoire", mode: "insensitive" } },
            { author: { name: { contains: "mémoire", mode: "insensitive" } } },
          ],
        }),
        orderBy: DOCUMENT_LIST_ORDER,
      }),
    );
  });

  it("pagine avec skip/take déterministes", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await new AdminDocumentService().list({
      actorId: "root",
      actorRole: "SUPER_ADMIN",
      q: "",
      page: 3,
      limit: 10,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10, orderBy: DOCUMENT_LIST_ORDER }));
  });

  it("getById hors périmètre : 404 (pas d’énumération)", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    findUnique.mockResolvedValue({
      id: "doc-2",
      universityId: "uni-2",
      status: "PENDING_REVIEW",
      deletedAt: null,
      currentVersion: 1,
    });
    await expect(new AdminDocumentService().getById("ia", "INSTITUTION_ADMIN", "doc-2")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("getById introuvable : 404", async () => {
    findUnique.mockResolvedValue(null);
    await expect(new AdminDocumentService().getById("root", "SUPER_ADMIN", "missing")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("getById n’expose ni objectKey ni DOI synthétique", async () => {
    findUnique
      .mockResolvedValueOnce({
        id: "doc-1",
        universityId: "uni-1",
        status: "APPROVED",
        deletedAt: null,
        currentVersion: 1,
      })
      .mockResolvedValueOnce({
        id: "doc-1",
        slug: "doc-1",
        title: "Titre",
        abstract: null,
        language: "fr",
        type: "ARTICLE",
        license: "CC",
        promotion: null,
        academicYear: "2025-2026",
        year: 2026,
        status: "APPROVED",
        currentVersion: 1,
        authorId: "a",
        viewCount: 0,
        downloadCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        publishedAt: stamped,
        createdAt: stamped,
        updatedAt: stamped,
        author: { id: "a", name: "Auteur", email: "a@example.test" },
        university: { id: "uni-1", name: "Université 1", acronym: "U1" },
        faculty: null,
        department: null,
        category: { id: "cat", name: "Droit" },
        files: [{ id: "f1", fileName: "memoire.pdf", mimeType: "application/pdf", sizeBytes: 1024, checksum: "ab", version: 1, isUploaded: true, scanStatus: "CLEAN", createdAt: stamped }],
        publication: { internalDoi: "10.87878/bicuni.doc-1", publishedAt: stamped },
        reviews: [],
        history: [],
      });

    const result = await new AdminDocumentService().getById("root", "SUPER_ADMIN", "doc-1");
    expect(result.doi).toBeNull();
    expect(result.publication?.doi).toBeNull();
    expect(result.authorId).toBe("a");
    expect(result.canArchive).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/objectKey/);
    expect(JSON.stringify(result)).not.toMatch(/10\.87878/);
  });

  it("refuse USER au périmètre admin", async () => {
    await expect(
      new AdminDocumentService().list({ actorId: "u", actorRole: "USER", q: "", page: 1, limit: 25 }),
    ).rejects.toBeInstanceOf(AdminDocumentError);
  });

  it("statistiques uniquement PostgreSQL et isolées", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    count.mockResolvedValue(0);
    const stats = await new AdminDocumentService().statistics("ia", "INSTITUTION_ADMIN");
    expect(stats).toEqual({ pending: 0, approved: 0, published: 0, rejected: 0, archived: 0 });
    expect(count).toHaveBeenCalledTimes(5);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ universityId: { in: ["uni-1"] }, status: "PENDING_REVIEW" }),
      }),
    );
  });

  it("review() écrit un AuditLog dans la même transaction que la transition", async () => {
    findUnique.mockResolvedValue({
      id: "doc-1",
      universityId: "uni-1",
      status: "PENDING_REVIEW",
      deletedAt: null,
      currentVersion: 1,
    });

    await new AdminDocumentService().review(
      "root",
      "SUPER_ADMIN",
      "doc-1",
      { decision: "APPROVED" },
      context,
    );

    expect(reviewInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ auditLog: { create: auditCreate } }),
      "doc-1",
      { id: "root", role: "SUPER_ADMIN" },
      { decision: "APPROVED" },
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DOCUMENT_APPROVED", entityType: "Document" }),
      }),
    );
  });

  it("annule toute la transaction si l’AuditLog échoue", async () => {
    findUnique.mockResolvedValue({
      id: "doc-1",
      universityId: "uni-1",
      status: "PENDING_REVIEW",
      deletedAt: null,
      currentVersion: 1,
    });
    auditCreate.mockRejectedValue(new Error("audit failed"));

    await expect(
      new AdminDocumentService().review("root", "SUPER_ADMIN", "doc-1", { decision: "APPROVED" }, context),
    ).rejects.toThrow(/audit failed/);
    expect(reviewInTransactionMock).toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled();
  });

  it("archive() est tracé et refuse hors périmètre", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    findUnique.mockResolvedValue({
      id: "doc-2",
      universityId: "uni-2",
      status: "APPROVED",
      deletedAt: null,
      currentVersion: 1,
    });
    await expect(
      new AdminDocumentService().archive("ia", "INSTITUTION_ADMIN", "doc-2", context),
    ).rejects.toMatchObject({ status: 404 });
    expect(archiveInTransactionMock).not.toHaveBeenCalled();
    expect(archiveMock).not.toHaveBeenCalled();
  });
});
