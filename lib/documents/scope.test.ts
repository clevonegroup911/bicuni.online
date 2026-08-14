import { beforeEach, describe, expect, it, vi } from "vitest";

const universityFindMany = vi.hoisted(() => vi.fn());

vi.mock("../db/client", () => ({
  db: { university: { findMany: universityFindMany } },
}));

import { canReadDocumentSecure, isDocumentInAdminScope, managedDocumentInstitutionIds } from "./scope";

describe("périmètre documentaire", () => {
  beforeEach(() => vi.clearAllMocks());

  it("donne un accès global à SUPER_ADMIN, ADMIN et MODERATOR", async () => {
    await expect(managedDocumentInstitutionIds("root", "SUPER_ADMIN")).resolves.toBeNull();
    await expect(managedDocumentInstitutionIds("adm", "ADMIN")).resolves.toBeNull();
    await expect(managedDocumentInstitutionIds("mod", "MODERATOR")).resolves.toBeNull();
    expect(universityFindMany).not.toHaveBeenCalled();
  });

  it("restreint INSTITUTION_ADMIN à ses mandats", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    await expect(managedDocumentInstitutionIds("ia", "INSTITUTION_ADMIN")).resolves.toEqual(["uni-1"]);
  });

  it("n’autorise pas la lecture privée cross-institution", async () => {
    universityFindMany.mockResolvedValue([{ id: "uni-1" }]);
    const pending = { authorId: "a", status: "PENDING_REVIEW", universityId: "uni-2" };
    await expect(canReadDocumentSecure({ id: "ia", role: "INSTITUTION_ADMIN" }, pending)).resolves.toBe(false);
    await expect(canReadDocumentSecure({ id: "mod", role: "MODERATOR" }, pending)).resolves.toBe(true);
  });

  it("isDocumentInAdminScope refuse un dépôt sans université pour un rôle institutionnel", () => {
    expect(isDocumentInAdminScope({ universityId: null }, ["uni-1"])).toBe(false);
    expect(isDocumentInAdminScope({ universityId: null }, null)).toBe(true);
  });
});
