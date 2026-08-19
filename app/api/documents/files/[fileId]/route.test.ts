import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fileFindUnique: vi.fn(),
  fileDelete: vi.fn(),
  storageDelete: vi.fn(),
  signedDownload: vi.fn(),
  canRead: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("../../../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({
  db: {
    documentFile: { findUnique: mocks.fileFindUnique, delete: mocks.fileDelete },
    document: { update: vi.fn() },
  },
}));
vi.mock("../../../../lib/db/client", () => ({
  db: {
    documentFile: { findUnique: mocks.fileFindUnique, delete: mocks.fileDelete },
    document: { update: vi.fn() },
  },
}));
vi.mock("@/lib/storage", () => ({
  privateStorage: () => ({ delete: mocks.storageDelete, createSignedDownload: mocks.signedDownload }),
}));
vi.mock("../../../../lib/storage", () => ({
  privateStorage: () => ({ delete: mocks.storageDelete, createSignedDownload: mocks.signedDownload }),
}));
vi.mock("@/lib/documents/scope", () => ({ canReadDocumentSecure: mocks.canRead }));
vi.mock("../../../../lib/documents/scope", () => ({ canReadDocumentSecure: mocks.canRead }));

import { DELETE, GET } from "./route";

describe("DELETE /api/documents/files/[fileId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("répond 405 et ne déclenche aucune suppression GCS ni SQL", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root", role: "SUPER_ADMIN" } });
    mocks.fileFindUnique.mockResolvedValue({ id: "f1", objectKey: "users/x/secret.pdf" });

    const response = await DELETE();

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "La suppression physique des fichiers est désactivée.",
    });
    expect(response.headers.get("Allow")).toBe("GET");
    expect(mocks.storageDelete).not.toHaveBeenCalled();
    expect(mocks.fileDelete).not.toHaveBeenCalled();
    expect(mocks.fileFindUnique).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents/files/[fileId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse le téléchargement public d’un fichier non CLEAN", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    mocks.fileFindUnique.mockResolvedValue({
      id: "f1",
      isUploaded: true,
      scanStatus: "PENDING",
      objectKey: "users/x/secret.pdf",
      fileName: "memoire.pdf",
      document: { id: "d1", authorId: "user-1", status: "PUBLISHED", universityId: "u1", deletedAt: null },
    });
    mocks.canRead.mockResolvedValue(true);

    const response = await GET(new Request("https://bicuni.online/api/documents/files/f1"), { params: Promise.resolve({ fileId: "f1" }) });
    expect(response.status).toBe(404);
    expect(mocks.signedDownload).not.toHaveBeenCalled();
  });
});
