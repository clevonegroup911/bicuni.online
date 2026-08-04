import { describe, expect, it } from "vitest";
import { can, isAdministrativeRole, isSuperAdmin, ROLES } from "./rbac";

describe("RBAC", () => {
  it("couvre les rôles Back Office et conserve les rôles académiques", () => {
    expect(ROLES).toEqual(["USER", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN", "GOVERNMENT"]);
  });
  it("limite les permissions administratives", () => {
    expect(can("USER", "admin:access")).toBe(false);
    expect(can("MODERATOR", "admin:documents:review")).toBe(true);
    expect(can("MODERATOR", "admin:users:manage")).toBe(false);
    expect(can("ADMIN", "admin:users:read")).toBe(true);
    expect(can("ADMIN", "admin:users:manage")).toBe(false);
    expect(can("SUPER_ADMIN", "admin:users:manage")).toBe(true);
  });
  it("identifie les rôles administratifs et le propriétaire", () => {
    expect(isAdministrativeRole("INSTITUTION_ADMIN")).toBe(true);
    expect(isAdministrativeRole("USER")).toBe(false);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });
});
