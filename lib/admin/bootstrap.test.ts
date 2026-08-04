import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  hash: vi.fn(async () => "hashed-password"),
}));

vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
vi.mock("../db/client", () => ({
  db: { user: { findUnique: mocks.findUnique, count: mocks.count }, $transaction: mocks.transaction },
}));

import { initializeSuperAdmin } from "./bootstrap";

describe("initialisation du premier SUPER_ADMIN", () => {
  beforeEach(() => vi.clearAllMocks());

  it("est idempotente lorsque le compte actif existe déjà", async () => {
    mocks.findUnique.mockResolvedValue({ id: "root", role: "SUPER_ADMIN", status: "ACTIVE" });
    await expect(initializeSuperAdmin({ email: "root@example.org", name: "Root Admin", password: "StrongPassword!42" }))
      .resolves.toEqual({ created: false, id: "root" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse de convertir silencieusement un compte ordinaire", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user", role: "USER", status: "ACTIVE" });
    await expect(initializeSuperAdmin({ email: "root@example.org", name: "Root Admin", password: "StrongPassword!42" }))
      .rejects.toThrow(/non administrateur/);
  });

  it("crée le compte et sa trace d'audit dans une transaction", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    const tx = { user: { create: vi.fn().mockResolvedValue({ id: "root" }) }, auditLog: { create: vi.fn().mockResolvedValue({}) } };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    await expect(initializeSuperAdmin({ email: "root@example.org", name: "Root Admin", password: "StrongPassword!42" }))
      .resolves.toEqual({ created: true, id: "root" });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passwordHash: "hashed-password", role: "SUPER_ADMIN", status: "ACTIVE" }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "SUPER_ADMIN_INITIALIZED" }) }));
  });
});
