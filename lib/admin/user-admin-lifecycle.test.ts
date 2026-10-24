import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  deleteManyToken: vi.fn(),
  createToken: vi.fn(),
  sendEmail: vi.fn(),
  rotate: vi.fn(),
  revoke: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed") }));
vi.mock("../db/client", () => ({
  db: {
    user: { findUnique: mocks.findUnique, count: mocks.count, update: mocks.update },
    auditLog: { create: mocks.auditCreate, findMany: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../auth/email-verification", () => ({
  revokeVerificationTokens: mocks.revoke,
  rotateVerificationToken: mocks.rotate,
  sendVerificationEmail: mocks.sendVerificationEmail,
}));
vi.mock("../observability/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { AdminUserError, AdminUserService, userStatusLabel } from "./user-admin-service";

const context = { ipHash: null, userAgent: null };

describe("AdminUserService cycle de vie", () => {
  const service = new AdminUserService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        user: {
          findUnique: mocks.findUnique,
          count: mocks.count,
          update: mocks.update,
        },
        auditLog: { create: mocks.auditCreate },
      };
      return callback(tx);
    });
  });

  it("affiche le libellé « En attente de vérification »", () => {
    expect(userStatusLabel("PENDING")).toBe("En attente de vérification");
  });

  it("refuse l’activation manuelle d’un compte PENDING", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      role: "USER",
      status: "PENDING",
      email: "p@example.test",
      emailVerified: null,
    });
    await expect(service.changeStatus("admin", "SUPER_ADMIN", "u1", "ACTIVE", context))
      .rejects.toThrow(/ne peut pas être activé manuellement/);
  });

  it("révoque les jetons à la suspension", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      role: "USER",
      status: "ACTIVE",
      email: "a@example.test",
      emailVerified: new Date(),
    });
    mocks.count.mockResolvedValue(2);
    mocks.update.mockResolvedValue({
      id: "u1",
      name: "A",
      email: "a@example.test",
      role: "USER",
      status: "SUSPENDED",
      emailVerified: new Date(),
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.revoke.mockResolvedValue(undefined);

    await service.changeStatus("admin", "SUPER_ADMIN", "u1", "SUSPENDED", context);
    expect(mocks.revoke).toHaveBeenCalledWith(expect.anything(), "a@example.test");
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADMIN_USER_SUSPENDED" }),
      }),
    );
  });

  it("réactive un compte SUSPENDED déjà vérifié", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      role: "USER",
      status: "SUSPENDED",
      email: "a@example.test",
      emailVerified: new Date(),
    });
    mocks.count.mockResolvedValue(1);
    mocks.update.mockResolvedValue({
      id: "u1",
      name: "A",
      email: "a@example.test",
      role: "USER",
      status: "ACTIVE",
      emailVerified: new Date(),
    });
    mocks.auditCreate.mockResolvedValue({});

    const user = await service.changeStatus("admin", "SUPER_ADMIN", "u1", "ACTIVE", context);
    expect(user.status).toBe("ACTIVE");
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADMIN_USER_REACTIVATED" }),
      }),
    );
  });

  it("refuse un changement de rôle non autorisé et journalise le refus", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u1", role: "USER", status: "ACTIVE" });
    mocks.count.mockResolvedValue(1);
    mocks.auditCreate.mockResolvedValue({});
    await expect(service.changeRole("admin", "ADMIN", "u1", "SUPER_ADMIN", context))
      .rejects.toBeInstanceOf(AdminUserError);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADMIN_ROLE_CHANGE_DENIED" }),
      }),
    );
  });

  it("renvoie la vérification pour un PENDING", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      email: "p@example.test",
      status: "PENDING",
      emailVerified: null,
      role: "USER",
    });
    mocks.rotate.mockResolvedValue("opaque");
    mocks.sendVerificationEmail.mockResolvedValue({ id: "ok" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({}));

    const result = await service.resendVerification(
      "admin",
      "SUPER_ADMIN",
      "u1",
      "https://bicuni.online",
      context,
    );
    expect(result.resent).toBe(true);
    expect(mocks.sendVerificationEmail).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADMIN_VERIFICATION_RESENT" }),
      }),
    );
  });
});
