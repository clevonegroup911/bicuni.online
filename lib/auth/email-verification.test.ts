import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueToken: vi.fn(),
  deleteToken: vi.fn(),
  deleteManyToken: vi.fn(),
  createToken: vi.fn(),
  updateManyUser: vi.fn(),
  findUniqueUser: vi.fn(),
  auditCreate: vi.fn(),
  sendEmail: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser },
    verificationToken: {
      findUnique: mocks.findUniqueToken,
      delete: mocks.deleteToken,
      deleteMany: mocks.deleteManyToken,
      create: mocks.createToken,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/email/service", () => ({
  sendEmail: mocks.sendEmail,
  authEmailTemplate: (_title: string, text: string) => text,
}));

import {
  resendVerificationForEmail,
  verifyEmailAddress,
} from "./email-verification";

describe("verifyEmailAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        verificationToken: {
          findUnique: mocks.findUniqueToken,
          delete: mocks.deleteToken,
          deleteMany: mocks.deleteManyToken,
          create: mocks.createToken,
        },
        user: {
          updateMany: mocks.updateManyUser,
          findUnique: mocks.findUniqueUser,
        },
        auditLog: { create: mocks.auditCreate },
      };
      return callback(tx);
    });
  });

  it("passe PENDING → ACTIVE et journalise AUTH_EMAIL_VERIFIED", async () => {
    mocks.findUniqueToken.mockResolvedValue({
      identifier: "user@example.test",
      token: "hash",
      expires: new Date(Date.now() + 60_000),
    });
    mocks.deleteToken.mockResolvedValue({});
    mocks.updateManyUser.mockResolvedValue({ count: 1 });
    mocks.findUniqueUser.mockResolvedValue({ id: "u1" });
    mocks.auditCreate.mockResolvedValue({});

    const result = await verifyEmailAddress("user@example.test", "opaque-token");
    expect(result).toEqual({ ok: true, message: "Adresse vérifiée. Vous pouvez vous connecter." });
    expect(mocks.deleteToken).toHaveBeenCalled();
    expect(mocks.updateManyUser).toHaveBeenCalledWith({
      where: { email: "user@example.test", status: "PENDING" },
      data: expect.objectContaining({ status: "ACTIVE" }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "AUTH_EMAIL_VERIFIED" }),
      }),
    );
  });

  it("refuse un jeton expiré ou inconnu", async () => {
    mocks.findUniqueToken.mockResolvedValue(null);
    const result = await verifyEmailAddress("user@example.test", "bad");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalide ou expiré/);
    expect(mocks.updateManyUser).not.toHaveBeenCalled();
  });

  it("interdit la réactivation d’un compte SUSPENDED via jeton (consommé)", async () => {
    mocks.findUniqueToken.mockResolvedValue({
      identifier: "user@example.test",
      token: "hash",
      expires: new Date(Date.now() + 60_000),
    });
    mocks.deleteToken.mockResolvedValue({});
    mocks.updateManyUser.mockResolvedValue({ count: 0 });
    mocks.findUniqueUser.mockResolvedValue({ id: "u1", status: "SUSPENDED", emailVerified: new Date() });
    mocks.auditCreate.mockResolvedValue({});

    const result = await verifyEmailAddress("user@example.test", "old-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ne peut pas activer/);
    expect(mocks.deleteToken).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "AUTH_VERIFY_REFUSED" }),
      }),
    );
  });

  it("interdit la réactivation d’un compte DELETED via jeton", async () => {
    mocks.findUniqueToken.mockResolvedValue({
      identifier: "user@example.test",
      token: "hash",
      expires: new Date(Date.now() + 60_000),
    });
    mocks.deleteToken.mockResolvedValue({});
    mocks.updateManyUser.mockResolvedValue({ count: 0 });
    mocks.findUniqueUser.mockResolvedValue({ id: "u1", status: "DELETED", emailVerified: new Date() });

    const result = await verifyEmailAddress("user@example.test", "old-token");
    expect(result.ok).toBe(false);
  });
});

describe("resendVerificationForEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        verificationToken: {
          deleteMany: mocks.deleteManyToken,
          create: mocks.createToken,
        },
      };
      return callback(tx);
    });
    mocks.deleteManyToken.mockResolvedValue({ count: 0 });
    mocks.createToken.mockResolvedValue({});
    mocks.sendEmail.mockResolvedValue({ id: "mail-1" });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("n’envoie rien pour un email inconnu (anti-énumération)", async () => {
    mocks.findUniqueUser.mockResolvedValue(null);
    await expect(
      resendVerificationForEmail({ email: "ghost@example.test", baseUrl: "https://bicuni.online" }),
    ).resolves.toEqual({ sent: false });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("renvoie un lien uniquement pour PENDING non vérifié", async () => {
    mocks.findUniqueUser.mockResolvedValue({
      id: "u1",
      email: "pending@example.test",
      emailVerified: null,
      status: "PENDING",
    });
    await expect(
      resendVerificationForEmail({ email: "pending@example.test", baseUrl: "https://bicuni.online" }),
    ).resolves.toEqual({ sent: true, userId: "u1" });
    expect(mocks.sendEmail).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "AUTH_VERIFICATION_RESENT" }),
      }),
    );
  });

  it("ignore un compte déjà ACTIVE", async () => {
    mocks.findUniqueUser.mockResolvedValue({
      id: "u1",
      email: "active@example.test",
      emailVerified: new Date(),
      status: "ACTIVE",
    });
    await expect(
      resendVerificationForEmail({ email: "active@example.test", baseUrl: "https://bicuni.online" }),
    ).resolves.toEqual({ sent: false });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
