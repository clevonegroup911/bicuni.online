import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  getMetadata: vi.fn(),
  createReadStream: vi.fn(),
  file: vi.fn(),
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return { file: mocks.file };
    }
  },
}));

describe("privateStorage", () => {
  beforeEach(() => {
    process.env.GCS_BUCKET = "test-only-bucket";
    mocks.exists.mockReset().mockResolvedValue([true]);
    mocks.getMetadata.mockReset().mockResolvedValue([{
      size: "4",
      contentType: "application/pdf",
    }]);
    mocks.createReadStream.mockReset().mockImplementation(() => Readable.from([Buffer.from("safe")]));
    mocks.file.mockReset().mockReturnValue({
      exists: mocks.exists,
      getMetadata: mocks.getMetadata,
      createReadStream: mocks.createReadStream,
    });
  });

  it("recalcule le SHA-256 depuis les octets stockés au lieu de faire confiance au client", async () => {
    const { privateStorage } = await import("./index");
    await expect(privateStorage().digest("users/test/document.pdf")).resolves.toEqual({
      exists: true,
      sizeBytes: 4,
      contentType: "application/pdf",
      checksum: "8b3369944dd2a3fab39e32d1aeb1f763946a458ae3e6368a46432adc8f3a0860",
    });
  });

  it("ne lit aucun flux lorsque l’objet GCS est absent", async () => {
    mocks.exists.mockResolvedValue([false]);
    const { privateStorage } = await import("./index");
    await expect(privateStorage().digest("users/test/missing.pdf")).resolves.toEqual({ exists: false });
    expect(mocks.createReadStream).not.toHaveBeenCalled();
  });
});
