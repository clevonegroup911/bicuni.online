import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("../db/client", () => ({ db: { user: { findUnique: mocks.findUnique } } }));

import { requireAdminApi } from "./guard";

describe("garde API administrative", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse un visiteur anonyme", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireAdminApi("admin:access")).rejects.toMatchObject({ status: 401 });
  });

  it("refuse un utilisateur sans rôle administratif", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user" } });
    mocks.findUnique.mockResolvedValue({ id: "user", role: "USER", status: "ACTIVE" });
    await expect(requireAdminApi("admin:access")).rejects.toMatchObject({ status: 403 });
  });

  it("refuse un administrateur suspendu", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "SUPER_ADMIN", status: "SUSPENDED" });
    await expect(requireAdminApi("admin:access")).rejects.toMatchObject({ status: 403 });
  });

  it("autorise un SUPER_ADMIN actif et bloque une origine tierce", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "root" } });
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    await expect(requireAdminApi("admin:users:manage")).resolves.toMatchObject({ id: "root" });
    const request = new Request("https://bicuni.online/api/admin/users", { headers: { origin: "https://attacker.example" } });
    await expect(requireAdminApi("admin:users:manage", request)).rejects.toMatchObject({ status: 403 });
  });
});
