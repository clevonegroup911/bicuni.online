import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClevonePaymentError } from "./types";

const mocks = vi.hoisted(() => {
  const tx = {
    paymentOrder: { create: vi.fn() },
    subscription: { create: vi.fn() },
    invoice: { create: vi.fn() },
    paymentIntent: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    paymentStateTransition: { create: vi.fn() },
    paymentAttempt: { create: vi.fn() },
    paymentProof: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    reconciliationDecision: { create: vi.fn() },
    payment: { upsert: vi.fn() },
    paymentReceipt: { upsert: vi.fn() },
    paymentRefund: { create: vi.fn() },
    plan: { findUnique: vi.fn() },
  };
  return {
    tx,
    findUniqueIntent: vi.fn(),
    findUniquePlan: vi.fn(),
    findFirstSub: vi.fn(),
    findFirstDuplicate: vi.fn(),
    findUniqueTxn: vi.fn(),
    countProofs: vi.fn(),
    transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    paymentIntent: {
      findUnique: mocks.findUniqueIntent,
      findFirst: mocks.findFirstDuplicate,
    },
    plan: { findUnique: mocks.findUniquePlan },
    subscription: { findFirst: mocks.findFirstSub },
    paymentProof: { count: mocks.countProofs },
    providerTransaction: { findUnique: mocks.findUniqueTxn },
    fxRate: { findFirst: vi.fn().mockResolvedValue(null) },
    user: { findUnique: vi.fn().mockResolvedValue({ email: "qa@example.test" }) },
    paymentNotification: { create: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/storage", () => ({
  privateStorageConfigured: () => false,
  privateStorage: () => ({
    createSignedUpload: vi.fn().mockResolvedValue("https://storage.googleapis.com/signed-upload"),
  }),
}));
vi.mock("@/lib/documents/antivirus-scanner", () => ({
  antivirusConfigured: () => false,
  antivirusScanner: () => ({ engine: "unconfigured", scan: vi.fn() }),
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/email/service", () => ({ sendEmail: vi.fn() }));

import { ClevonePaymentService } from "./service";

describe("ClevonePaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUniqueIntent.mockResolvedValue(null);
    mocks.findFirstSub.mockResolvedValue(null);
    mocks.findUniquePlan.mockResolvedValue({
      id: "plan-1",
      slug: "starter",
      name: "Starter",
      priceCents: 200,
      currency: "USD",
      interval: "month",
      active: true,
    });
    mocks.tx.paymentOrder.create.mockResolvedValue({ id: "order-1" });
    mocks.tx.subscription.create.mockResolvedValue({ id: "sub-1" });
    mocks.tx.invoice.create.mockResolvedValue({ id: "inv-1" });
    mocks.tx.paymentIntent.create.mockResolvedValue({ publicRef: "CLEV-TEST-REF", id: "intent-1" });
  });

  it("crée une facture en attente sans activer l’abonnement", async () => {
    const service = new ClevonePaymentService();
    const result = await service.createCheckout({
      userId: "user-1",
      userEmail: "qa@example.test",
      planSlug: "starter",
      channel: "RAWBANK_USD",
      idempotencyKey: "idem-12345678",
    });
    expect(result.reused).toBe(false);
    expect(mocks.tx.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "INCOMPLETE" }),
    }));
    expect(mocks.tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "open", amountPaidCents: 0 }),
    }));
  });

  it("réutilise la même clé d’idempotence", async () => {
    mocks.findUniqueIntent.mockResolvedValue({ publicRef: "CLEV-EXISTING", status: "AWAITING_PAYMENT", userId: "user-1" });
    const service = new ClevonePaymentService();
    const result = await service.createCheckout({
      userId: "user-1",
      userEmail: "qa@example.test",
      planSlug: "starter",
      channel: "RAWBANK_USD",
      idempotencyKey: "idem-12345678",
    });
    expect(result).toEqual({ publicRef: "CLEV-EXISTING", reused: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse un second confirmateur identique", async () => {
    const future = new Date(Date.now() + 60_000);
    mocks.findUniqueIntent.mockResolvedValue({
      id: "intent-1",
      publicRef: "CLEV-TEST-REF",
      userId: "user-1",
      status: "REVIEW_REQUIRED",
      proposedPaidById: "admin-1",
      expiresAt: future,
      matchClass: "STRONG",
      riskLevel: "LOW",
      amountCents: 200,
      currency: "USD",
      channel: "RAWBANK_USD",
      planId: "plan-1",
      orderId: "order-1",
      invoiceId: "inv-1",
      subscriptionId: "sub-1",
      plan: { name: "Starter", interval: "month" },
      user: { id: "user-1", email: "qa@example.test", name: "QA" },
      attempts: [],
      proofs: [],
      decisions: [],
      transitions: [],
      receipt: null,
      refunds: [],
      notifications: [],
    });
    const service = new ClevonePaymentService();
    await expect(service.decide({
      publicRef: "CLEV-TEST-REF",
      actorId: "admin-1",
      actorRole: "ADMIN",
      mfaEnabled: false,
      mfaSecretEnc: null,
      action: "CONFIRM_PAID",
      reason: "Même opérateur interdit",
      context: { ipHash: null, userAgent: null },
    })).rejects.toBeInstanceOf(ClevonePaymentError);
  });

  it("refuse une preuve si le stockage ou l’antivirus n’est pas configuré", async () => {
    const future = new Date(Date.now() + 60_000);
    mocks.findUniqueIntent.mockResolvedValue({
      id: "intent-1",
      publicRef: "CLEV-TEST-REF",
      userId: "user-1",
      status: "AWAITING_PAYMENT",
      expiresAt: future,
      channel: "RAWBANK_USD",
      amountCents: 200,
      currency: "USD",
      destinationAccount: "15150-00978276002-01",
      createdAt: new Date(),
      plan: { name: "Starter" },
      user: { id: "user-1", email: "qa@example.test", name: "QA" },
      attempts: [],
      proofs: [],
      decisions: [],
      transitions: [],
      receipt: null,
      refunds: [],
      notifications: [],
    });
    const service = new ClevonePaymentService();
    await expect(service.submitProof({
      publicRef: "CLEV-TEST-REF",
      userId: "user-1",
      payerName: "Test Payer",
      payerPhone: "+243800000000",
      providerTxnRef: "TXN-TEST-1",
      amountCents: 200,
      currency: "USD",
      paidAtClient: new Date().toISOString(),
      destinationAccount: "15150-00978276002-01",
      invoiceRef: "CLEV-TEST-REF",
      fileName: "TEST-proof.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    })).rejects.toMatchObject({ status: 503, message: "Service temporairement indisponible." });
  });

  it("refuse CONFIRM_PAID avec MFA invalide lorsque MFA est exigé", async () => {
    process.env.CLEVONE_REQUIRE_MFA = "1";
    process.env.AUTH_SECRET = "test-secret-for-totp-clevone-module";
    const future = new Date(Date.now() + 60_000);
    mocks.findUniqueIntent.mockResolvedValue({
      id: "intent-1",
      publicRef: "CLEV-TEST-REF",
      userId: "user-1",
      status: "REVIEW_REQUIRED",
      proposedPaidById: "admin-1",
      expiresAt: future,
      matchClass: "STRONG",
      riskLevel: "LOW",
      amountCents: 200,
      currency: "USD",
      channel: "RAWBANK_USD",
      planId: "plan-1",
      orderId: "order-1",
      invoiceId: "inv-1",
      subscriptionId: "sub-1",
      plan: { name: "Starter", interval: "month" },
      user: { id: "user-1", email: "qa@example.test", name: "QA" },
      attempts: [],
      proofs: [],
      decisions: [],
      transitions: [],
      receipt: null,
      refunds: [],
      notifications: [],
    });
    const service = new ClevonePaymentService();
    await expect(service.decide({
      publicRef: "CLEV-TEST-REF",
      actorId: "admin-2",
      actorRole: "ADMIN",
      mfaEnabled: true,
      mfaSecretEnc: "not-a-valid-secret",
      totp: "000000",
      action: "CONFIRM_PAID",
      reason: "Validation manuelle TEST",
      context: { ipHash: null, userAgent: null },
    })).rejects.toMatchObject({ status: 403 });
    delete process.env.CLEVONE_REQUIRE_MFA;
  });
});
