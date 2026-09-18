import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  transaction: vi.fn(),
  createWebhook: vi.fn(),
  upsertSubscription: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/payments/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
}));
vi.mock("@/lib/db/client", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { Prisma } from "@prisma/client";
import { POST as webhookPOST } from "../../app/api/payments/webhooks/stripe/route";

describe("POST /api/payments/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_webhook");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      webhookEvent: { create: mocks.createWebhook },
      subscription: { upsert: mocks.upsertSubscription, updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: { update: mocks.updateUser },
      invoice: { upsert: vi.fn() },
      payment: { upsert: vi.fn() },
    }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("refuse une requête sans signature", async () => {
    const response = await webhookPOST(new Request("https://bicuni.online/api/payments/webhooks/stripe", {
      method: "POST",
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("refuse une signature invalide", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const response = await webhookPOST(new Request("https://bicuni.online/api/payments/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bad" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Signature invalide." });
  });

  it("active l’abonnement sur checkout.session.completed", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-1", planId: "plan-1" },
          client_reference_id: "user-1",
          subscription: "sub_123",
          customer: "cus_123",
        },
      },
    });
    const response = await webhookPOST(new Request("https://bicuni.online/api/payments/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=ok" },
      body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(mocks.createWebhook).toHaveBeenCalledWith({
      data: { provider: "STRIPE", providerEventId: "evt_1", eventType: "checkout.session.completed" },
    });
    expect(mocks.upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({
      where: { providerRef: "sub_123" },
      create: expect.objectContaining({ userId: "user-1", planId: "plan-1", status: "ACTIVE" }),
    }));
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { stripeCustomerId: "cus_123" },
    });
  });

  it("acquitte un webhook dupliqué via P2002", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u", planId: "p" }, subscription: "sub_x" } },
    });
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const response = await webhookPOST(new Request("https://bicuni.online/api/payments/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=ok" },
      body: "{}",
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
  });
});
