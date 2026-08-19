import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    documentFile: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

import { confirmStoredDocumentFile, FileIngestionError } from "./file-ingestion";

const actor = { id: "user-1", role: "USER" as const };
const file = {
  id: "file-1",
  objectKey: "users/user-1/doc.pdf",
  mimeType: "application/pdf",
  sizeBytes: 4,
  checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  isUploaded: false,
  scanStatus: "PENDING",
  document: { authorId: "user-1" },
};

function digest(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    sizeBytes: 4,
    contentType: "application/pdf",
    checksum: file.checksum,
    ...overrides,
  };
}

describe("confirmStoredDocumentFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(file);
    mocks.update.mockResolvedValue({});
  });

  it("ignore isUploaded=true envoyé par le client et refuse une empreinte falsifiée", async () => {
    await expect(confirmStoredDocumentFile(
      { fileId: "file-1", actor, payload: { fileId: "file-1", isUploaded: true } },
      { storage: { digest: async () => digest({ checksum: "ff".repeat(32) }) } as never },
    )).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/intégrité/) });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scanStatus: "REJECTED", checksum: "ff".repeat(32) }),
    }));
  });

  it("refuse une taille qui ne correspond pas au flux réel", async () => {
    await expect(confirmStoredDocumentFile(
      { fileId: "file-1", actor },
      { storage: { digest: async () => digest({ sizeBytes: 99 }) } as never },
    )).rejects.toBeInstanceOf(FileIngestionError);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scanStatus: "REJECTED", sizeBytes: 99 }),
    }));
  });

  it("ne marque pas CLEAN si le scanner n’est pas configuré", async () => {
    const result = await confirmStoredDocumentFile(
      { fileId: "file-1", actor, payload: { fileId: "file-1", isUploaded: true } },
      {
        storage: { digest: async () => digest() } as never,
        scanner: { engine: "unconfigured", scan: async () => ({ verdict: "unavailable", engine: "unconfigured" }) },
      },
    );
    expect(result.confirmed).toBe(false);
    expect(result.scanStatus).toBe("PENDING");
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isUploaded: true, scanStatus: "PENDING" }),
    }));
  });

  it("refuse un verdict rejected du scanner", async () => {
    await expect(confirmStoredDocumentFile(
      { fileId: "file-1", actor },
      {
        storage: { digest: async () => digest() } as never,
        scanner: { engine: "http", scan: async () => ({ verdict: "rejected", engine: "http" }) },
      },
    )).rejects.toMatchObject({ status: 422 });
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scanStatus: "REJECTED" }),
    }));
  });

  it("n’accepte un fichier qu’après recalcul serveur et verdict clean", async () => {
    const result = await confirmStoredDocumentFile(
      { fileId: "file-1", actor },
      {
        storage: { digest: async () => digest() } as never,
        scanner: { engine: "http", scan: async () => ({ verdict: "clean", engine: "http" }) },
      },
    );
    expect(result).toMatchObject({ confirmed: true, scanStatus: "CLEAN", checksum: file.checksum, sizeBytes: 4 });
  });
});
