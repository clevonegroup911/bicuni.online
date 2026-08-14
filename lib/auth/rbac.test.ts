import { describe, expect, it } from "vitest";
import { can, isAdministrativeRole, isSuperAdmin, ROLES } from "./rbac";

describe("RBAC", () => {
  it("couvre les rôles Back Office et conserve les rôles académiques", () => {
    expect(ROLES).toEqual(["USER", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN", "GOVERNMENT"]);
  });
  it("limite les permissions administratives", () => {
    expect(can("USER", "admin:access")).toBe(false);
    expect(can("MODERATOR", "admin:documents:review")).toBe(true);
    expect(can("MODERATOR", "admin:pids:read")).toBe(true);
    expect(can("MODERATOR", "admin:pids:manage")).toBe(false);
    expect(can("ADMIN", "admin:pids:manage")).toBe(true);
    expect(can("INSTITUTION_ADMIN", "admin:pids:read")).toBe(true);
    expect(can("INSTITUTION_ADMIN", "admin:pids:manage")).toBe(false);
    expect(can("MODERATOR", "admin:users:manage")).toBe(false);
    expect(can("ADMIN", "admin:users:read")).toBe(true);
    expect(can("ADMIN", "admin:users:manage")).toBe(false);
    expect(can("SUPER_ADMIN", "admin:users:manage")).toBe(true);
    expect(can("ADMIN", "admin:institutions:read")).toBe(true);
    expect(can("ADMIN", "admin:institutions:manage")).toBe(true);
    expect(can("INSTITUTION_ADMIN", "admin:institutions:manage")).toBe(true);
    expect(can("MODERATOR", "admin:institutions:manage")).toBe(false);
    expect(can("USER", "admin:documents:review")).toBe(false);
    expect(can("STUDENT", "admin:documents:review")).toBe(false);
    expect(can("RESEARCHER", "admin:documents:review")).toBe(false);
    expect(can("GOVERNMENT", "admin:access")).toBe(false);
  });
  it("identifie les rôles administratifs et le propriétaire", () => {
    expect(isAdministrativeRole("INSTITUTION_ADMIN")).toBe(true);
    expect(isAdministrativeRole("USER")).toBe(false);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });
});
