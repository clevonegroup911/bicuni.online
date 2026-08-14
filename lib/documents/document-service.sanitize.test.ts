import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client", () => ({ db: {} }));

import { sanitizeDocumentForClient } from "./document-service";

describe("sanitizeDocumentForClient", () => {
  it("retire objectKey et le DOI synthétique", () => {
    const result = sanitizeDocumentForClient({
      id: "doc-1",
      thumbnailObjectKey: "users/x/thumb.svg",
      files: [{ id: "f1", objectKey: "users/x/secret.pdf", fileName: "memoire.pdf" }],
      publication: { internalDoi: "10.87878/bicuni.doc-1", publishedAt: new Date("2026-01-01") },
    });
    expect(result).not.toHaveProperty("thumbnailObjectKey");
    expect(result.files?.[0]).not.toHaveProperty("objectKey");
    expect(result.files?.[0].fileName).toBe("memoire.pdf");
    expect(result.publication?.internalDoi).toBeNull();
  });
});
