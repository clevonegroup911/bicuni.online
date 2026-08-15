import { beforeEach, describe, expect, it, vi } from "vitest";

const universityFindUnique = vi.hoisted(() => vi.fn());
const facultyFindUnique = vi.hoisted(() => vi.fn());
const departmentFindUnique = vi.hoisted(() => vi.fn());

vi.mock("../db/client", () => ({
  db: {
    university: { findUnique: universityFindUnique },
    faculty: { findUnique: facultyFindUnique },
    department: { findUnique: departmentFindUnique },
  },
}));

import { assertInstitutionHierarchy, sanitizeDocumentForClient } from "./document-service";

describe("sanitizeDocumentForClient", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("refuse une faculté ou un département hors de la hiérarchie sélectionnée", async () => {
    universityFindUnique.mockResolvedValue({ id: "uni-1", status: "ACTIVE" });
    facultyFindUnique.mockResolvedValue({ universityId: "uni-2" });
    await expect(assertInstitutionHierarchy({ universityId: "uni-1", facultyId: "fac-1" }))
      .rejects.toThrow(/faculté ne correspond pas/);

    facultyFindUnique.mockResolvedValue({ universityId: "uni-1" });
    departmentFindUnique.mockResolvedValue({ facultyId: "fac-2" });
    await expect(assertInstitutionHierarchy({ universityId: "uni-1", facultyId: "fac-1", departmentId: "dep-1" }))
      .rejects.toThrow(/département ne correspond pas/);
  });

  it("accepte une hiérarchie institutionnelle active et cohérente", async () => {
    universityFindUnique.mockResolvedValue({ id: "uni-1", status: "ACTIVE" });
    facultyFindUnique.mockResolvedValue({ universityId: "uni-1" });
    departmentFindUnique.mockResolvedValue({ facultyId: "fac-1" });
    await expect(assertInstitutionHierarchy({ universityId: "uni-1", facultyId: "fac-1", departmentId: "dep-1" }))
      .resolves.toBeUndefined();
  });
});
