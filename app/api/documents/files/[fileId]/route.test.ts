import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fileFindUnique: vi.fn(),
  fileDelete: vi.fn(),
  storageDelete: vi.fn(),
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
  privateStorage: () => ({ delete: mocks.storageDelete, createSignedDownload: vi.fn() }),
}));
vi.mock("../../../../lib/storage", () => ({
  privateStorage: () => ({ delete: mocks.storageDelete, createSignedDownload: vi.fn() }),
}));
vi.mock("@/lib/documents/scope", () => ({ canReadDocumentSecure: vi.fn() }));
vi.mock("../../../../lib/documents/scope", () => ({ canReadDocumentSecure: vi.fn() }));

import { DELETE } from "./route";

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
