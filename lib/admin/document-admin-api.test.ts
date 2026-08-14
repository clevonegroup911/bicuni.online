import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AdminDocumentError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  }
  return {
    auth: vi.fn(),
    findUnique: vi.fn(),
    list: vi.fn(),
    statistics: vi.fn(),
    getById: vi.fn(),
    review: vi.fn(),
    archive: vi.fn(),
    AdminDocumentError,
  };
});

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("../db/client", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/db/client", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("./document-admin-service", () => ({
  AdminDocumentError: mocks.AdminDocumentError,
  AdminDocumentService: class {
    list = mocks.list;
    statistics = mocks.statistics;
    getById = mocks.getById;
    review = mocks.review;
    archive = mocks.archive;
  },
}));
vi.mock("@/lib/admin/document-admin-service", () => ({
  AdminDocumentError: mocks.AdminDocumentError,
  AdminDocumentService: class {
    list = mocks.list;
    statistics = mocks.statistics;
    getById = mocks.getById;
    review = mocks.review;
    archive = mocks.archive;
  },
}));

import { GET as listGET } from "../../app/api/admin/documents/route";
import { GET as detailGET, PATCH } from "../../app/api/admin/documents/[id]/route";

const validId = "cm12345678901234567890123";

describe("API admin documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ documents: [], total: 0, page: 1, pageSize: 25 });
    mocks.statistics.mockResolvedValue({ pending: 0, approved: 0, published: 0, rejected: 0, archived: 0 });
  });

  it("refuse un visiteur anonyme avec 401", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await listGET(new Request("https://bicuni.online/api/admin/documents"));
    expect(response.status).toBe(401);
  });

  it("refuse un USER avec 403", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user" } });
    mocks.findUnique.mockResolvedValue({ id: "user", role: "USER", status: "ACTIVE" });
    const response = await listGET(new Request("https://bicuni.online/api/admin/documents"));
    expect(response.status).toBe(403);
  });

  it("refuse STUDENT et RESEARCHER", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "student" } });
    mocks.findUnique.mockResolvedValue({ id: "student", role: "STUDENT", status: "ACTIVE" });
    expect((await listGET(new Request("https://bicuni.online/api/admin/documents"))).status).toBe(403);
    mocks.findUnique.mockResolvedValue({ id: "researcher", role: "RESEARCHER", status: "ACTIVE" });
    expect((await listGET(new Request("https://bicuni.online/api/admin/documents"))).status).toBe(403);
  });

  it("rejette des filtres invalides avec 400", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root" } });
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    const response = await listGET(new Request("https://bicuni.online/api/admin/documents?page=-1"));
    expect(response.status).toBe(400);
  });

  it("détail introuvable : 404", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root" } });
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    mocks.getById.mockRejectedValue(new mocks.AdminDocumentError("Document introuvable.", 404));
    const response = await detailGET(new Request(`https://bicuni.online/api/admin/documents/${validId}`), {
      params: Promise.resolve({ id: validId }),
    });
    expect(response.status).toBe(404);
  });

  it("identifiant non cuid : 404", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root" } });
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    const response = await detailGET(new Request("https://bicuni.online/api/admin/documents/not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.getById).not.toHaveBeenCalled();
  });

  it("refuse un rejet sans motif", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root" } });
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    const response = await PATCH(
      new Request(`https://bicuni.online/api/admin/documents/${validId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "review", review: { decision: "REJECTED" } }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.review).not.toHaveBeenCalled();
  });
});
