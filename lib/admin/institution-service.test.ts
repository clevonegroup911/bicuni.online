import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client", () => ({ db: {} }));

import {
  assertCanChangeInstitutionStatus,
  assertCanCreateInstitution,
  assertStatusTransition,
  canManageInstitutionGlobally,
  canReadInstitutionAudit,
  isInstitutionScopedRole,
  slugifyInstitutionName,
  INSTITUTION_LIST_ORDER,
} from "./institution-service";

describe("permissions institutions", () => {
  it("autorise SUPER_ADMIN et ADMIN à gérer globalement", () => {
    expect(canManageInstitutionGlobally("SUPER_ADMIN")).toBe(true);
    expect(canManageInstitutionGlobally("ADMIN")).toBe(true);
    expect(canManageInstitutionGlobally("INSTITUTION_ADMIN")).toBe(false);
    expect(canManageInstitutionGlobally("USER")).toBe(false);
  });

  it("identifie les rôles à périmètre institutionnel", () => {
    expect(isInstitutionScopedRole("INSTITUTION_ADMIN")).toBe(true);
    expect(isInstitutionScopedRole("UNIVERSITY_ADMIN")).toBe(true);
    expect(isInstitutionScopedRole("ADMIN")).toBe(false);
  });

  it("ne donne pas admin:audit:read aux INSTITUTION_ADMIN", () => {
    expect(canReadInstitutionAudit("INSTITUTION_ADMIN")).toBe(false);
    expect(canReadInstitutionAudit("UNIVERSITY_ADMIN")).toBe(false);
    expect(canReadInstitutionAudit("ADMIN")).toBe(true);
    expect(canReadInstitutionAudit("SUPER_ADMIN")).toBe(true);
  });

  it("interdit la création hors SUPER_ADMIN/ADMIN", () => {
    expect(() => assertCanCreateInstitution("INSTITUTION_ADMIN")).toThrow(/créer une institution/);
    expect(() => assertCanCreateInstitution("USER")).toThrow(/créer une institution/);
    expect(() => assertCanCreateInstitution("SUPER_ADMIN")).not.toThrow();
    expect(() => assertCanCreateInstitution("ADMIN")).not.toThrow();
  });

  it("interdit le changement de statut aux INSTITUTION_ADMIN", () => {
    expect(() => assertCanChangeInstitutionStatus("INSTITUTION_ADMIN")).toThrow(/changer le statut/);
    expect(() => assertCanChangeInstitutionStatus("ADMIN")).not.toThrow();
  });
});

describe("transitions de statut institutions", () => {
  it("autorise activation, suspension et archivage", () => {
    expect(() => assertStatusTransition("PENDING", "ACTIVE")).not.toThrow();
    expect(() => assertStatusTransition("ACTIVE", "SUSPENDED")).not.toThrow();
    expect(() => assertStatusTransition("SUSPENDED", "ACTIVE")).not.toThrow();
    expect(() => assertStatusTransition("ACTIVE", "ARCHIVED")).not.toThrow();
  });

  it("interdit les transitions invalides et le no-op", () => {
    expect(() => assertStatusTransition("ACTIVE", "ACTIVE")).toThrow(/déjà appliqué/);
    expect(() => assertStatusTransition("ARCHIVED", "SUSPENDED")).toThrow(/archivée/);
    expect(() => assertStatusTransition("PENDING", "PENDING")).toThrow(/déjà appliqué/);
  });
});

describe("création / modification utilitaires", () => {
  it("produit un slug stable", () => {
    expect(slugifyInstitutionName("Université de Kinshasa")).toBe("universite-de-kinshasa");
    expect(slugifyInstitutionName("  UNIKIN!!!  ")).toBe("unikin");
  });

  it("définit un ordre de liste déterministe", () => {
    expect(INSTITUTION_LIST_ORDER).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });
});
