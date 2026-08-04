import { describe, expect, it, vi } from "vitest";
vi.mock("../db/client", () => ({ db: {} }));
import { assertRoleChangeAllowed, assertStatusChangeAllowed } from "./user-admin-service";

describe("invariants de gestion administrative", () => {
  it("interdit de modifier son propre rôle", () => expect(() => assertRoleChangeAllowed({ actorId: "root", actorRole: "SUPER_ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", currentStatus: "ACTIVE", nextRole: "ADMIN", activeSuperAdmins: 2 })).toThrow(/propre rôle/));
  it("interdit à un ADMIN de modifier un SUPER_ADMIN", () => expect(() => assertRoleChangeAllowed({ actorId: "admin", actorRole: "ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", currentStatus: "ACTIVE", nextRole: "ADMIN", activeSuperAdmins: 2 })).toThrow(/Seul un SUPER_ADMIN/));
  it("interdit de rétrograder le dernier SUPER_ADMIN actif", () => expect(() => assertRoleChangeAllowed({ actorId: "root-2", actorRole: "SUPER_ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", currentStatus: "ACTIVE", nextRole: "ADMIN", activeSuperAdmins: 1 })).toThrow(/dernier SUPER_ADMIN/));
  it("autorise la rétrogradation d’un SUPER_ADMIN déjà inactif", () => expect(() => assertRoleChangeAllowed({ actorId: "root-2", actorRole: "SUPER_ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", currentStatus: "SUSPENDED", nextRole: "ADMIN", activeSuperAdmins: 1 })).not.toThrow());
  it("autorise la rétrogradation lorsqu’un autre SUPER_ADMIN actif existe", () => expect(() => assertRoleChangeAllowed({ actorId: "root-2", actorRole: "SUPER_ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", currentStatus: "ACTIVE", nextRole: "ADMIN", activeSuperAdmins: 2 })).not.toThrow());
  it("interdit de suspendre le dernier SUPER_ADMIN actif", () => expect(() => assertStatusChangeAllowed({ actorId: "root-2", actorRole: "SUPER_ADMIN", targetId: "root", currentRole: "SUPER_ADMIN", nextStatus: "SUSPENDED", activeSuperAdmins: 1 })).toThrow(/dernier SUPER_ADMIN/));
  it("interdit l’auto-suspension", () => expect(() => assertStatusChangeAllowed({ actorId: "root", actorRole: "ADMIN", targetId: "root", currentRole: "ADMIN", nextStatus: "SUSPENDED", activeSuperAdmins: 1 })).toThrow(/propre compte/));
});
