import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  documentFindUnique,
  documentUpdateMany,
  reviewCreate,
  historyCreate,
  publicationFindUnique,
  publicationUpsert,
  universityFindMany,
  transaction,
  ensureForPublishedDocument,
} = vi.hoisted(() => ({
  documentFindUnique: vi.fn(),
  documentUpdateMany: vi.fn(),
  reviewCreate: vi.fn(),
  historyCreate: vi.fn(),
  publicationFindUnique: vi.fn(),
  publicationUpsert: vi.fn(),
  universityFindMany: vi.fn(),
  transaction: vi.fn(),
  ensureForPublishedDocument: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    university: { findMany: universityFindMany },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/pid/service", () => ({
  PersistentIdentifierService: class {
    ensureForPublishedDocument = ensureForPublishedDocument;
  },
}));

import { ReviewService } from "./review-service";

const pending = {
  id: "doc-1",
  status: "PENDING_REVIEW",
  universityId: "uni-1",
  currentVersion: 1,
  authorId: "author-1",
  type: "ARTICLE",
};

function tx() {
  return {
    document: { findUnique: documentFindUnique, updateMany: documentUpdateMany },
    review: { create: reviewCreate },
    documentHistory: { create: historyCreate },
    publication: { findUnique: publicationFindUnique, upsert: publicationUpsert },
  };
}

describe("ReviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback: (client: ReturnType<typeof tx>) => unknown) => callback(tx()));
    reviewCreate.mockResolvedValue({});
    historyCreate.mockResolvedValue({});
    documentUpdateMany.mockResolvedValue({ count: 1 });
    publicationFindUnique.mockResolvedValue(null);
    publicationUpsert.mockResolvedValue({});
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue(pending);
    ensureForPublishedDocument.mockResolvedValue({ identifier: "bcu/2026.art.TESTULID000000000000" });
  });

  it("n’assigne aucun DOI synthétique lors d’une approbation", async () => {
    await new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" });
    expect(publicationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ internalDoi: null, documentId: "doc-1" }),
        update: expect.objectContaining({ internalDoi: null }),
      }),
    );
    expect(JSON.stringify(publicationUpsert.mock.calls[0][0])).not.toMatch(/10\.87878/);
    expect(ensureForPublishedDocument).toHaveBeenCalledTimes(1);
    expect(ensureForPublishedDocument).toHaveBeenCalledWith(
      expect.anything(),
      { id: "doc-1", type: "ARTICLE" },
      "root",
    );
  });

  it("neutralise un DOI synthétique historique à l’approbation", async () => {
    publicationFindUnique.mockResolvedValue({ internalDoi: "10.87878/bicuni.doc-1" });
    await new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" });
    expect(publicationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ internalDoi: null }) }),
    );
  });

  it("conserve un DOI réel déjà enregistré", async () => {
    publicationFindUnique.mockResolvedValue({ internalDoi: "10.1234/example.real" });
    await new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" });
    expect(publicationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ internalDoi: "10.1234/example.real" }) }),
    );
  });

  it("refuse un rejet sans motif", async () => {
    await expect(
      new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "REJECTED" }),
    ).rejects.toThrow(/motif de rejet/);
    expect(documentUpdateMany).not.toHaveBeenCalled();
    expect(publicationUpsert).not.toHaveBeenCalled();
    expect(ensureForPublishedDocument).not.toHaveBeenCalled();
  });

  it("refuse un rejet avec motif vide", async () => {
    await expect(
      new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "REJECTED", comment: "   " }),
    ).rejects.toThrow(/motif de rejet/);
  });

  it("refuse la validation hors PENDING_REVIEW", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue({ ...pending, status: "DRAFT" });
    await expect(
      new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" }),
    ).rejects.toThrow(/attente/);
    expect(documentUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse une seconde transition concurrente (TOCTOU) avec 409", async () => {
    documentUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(reviewCreate).not.toHaveBeenCalled();
    expect(historyCreate).not.toHaveBeenCalled();
    expect(publicationUpsert).not.toHaveBeenCalled();
  });

  it("applique updateMany conditionnel sur PENDING_REVIEW", async () => {
    await new ReviewService().review("doc-1", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" });
    expect(documentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1", status: "PENDING_REVIEW" },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });

  it("refuse un USER", async () => {
    await expect(
      new ReviewService().review("doc-1", { id: "user", role: "USER" }, { decision: "APPROVED" }),
    ).rejects.toThrow(/Validation refusée/);
  });

  it("refuse un INSTITUTION_ADMIN hors de son université", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue({ ...pending, universityId: "uni-2" });
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    await expect(
      new ReviewService().review("doc-1", { id: "ia", role: "INSTITUTION_ADMIN" }, { decision: "APPROVED" }),
    ).rejects.toThrow(/votre université/);
  });

  it("autorise un INSTITUTION_ADMIN sur son université", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    await new ReviewService().review("doc-1", { id: "ia", role: "INSTITUTION_ADMIN" }, { decision: "APPROVED" });
    expect(publicationUpsert).toHaveBeenCalled();
  });

  it("refuse l’archivage à un MODERATOR", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue({ ...pending, status: "APPROVED", authorId: "author-1" });
    await expect(
      new ReviewService().archive("doc-1", { id: "mod", role: "MODERATOR" }),
    ).rejects.toThrow(/Archivage refusé/);
    expect(documentUpdateMany).not.toHaveBeenCalled();
  });

  it("archive un document APPROVED pour SUPER_ADMIN", async () => {
    documentFindUnique.mockReset();
    documentFindUnique
      .mockResolvedValueOnce({ ...pending, status: "APPROVED", authorId: "author-1" })
      .mockResolvedValueOnce({ ...pending, status: "ARCHIVED", authorId: "author-1" });
    await new ReviewService().archive("doc-1", { id: "root", role: "SUPER_ADMIN" });
    expect(documentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1", status: { in: ["APPROVED", "PUBLISHED"] } },
        data: { status: "ARCHIVED" },
      }),
    );
    expect(historyCreate).toHaveBeenCalled();
  });

  it("refuse un second archivage concurrent avec 409", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue({ ...pending, status: "APPROVED", authorId: "author-1" });
    documentUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      new ReviewService().archive("doc-1", { id: "root", role: "SUPER_ADMIN" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("refuse l’archivage d’un brouillon", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue({ ...pending, status: "DRAFT", authorId: "author-1" });
    await expect(
      new ReviewService().archive("doc-1", { id: "root", role: "SUPER_ADMIN" }),
    ).rejects.toThrow(/Archivage refusé/);
  });

  it("retourne 404 si le document n’existe pas", async () => {
    documentFindUnique.mockReset();
    documentFindUnique.mockResolvedValue(null);
    await expect(
      new ReviewService().review("missing", { id: "root", role: "SUPER_ADMIN" }, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
