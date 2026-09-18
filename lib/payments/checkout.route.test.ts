import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  planFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({
  db: {
    plan: { findUnique: mocks.planFindUnique },
    user: { findUnique: mocks.userFindUnique },
    subscription: { findFirst: mocks.subscriptionFindFirst },
  },
}));
vi.mock("@/lib/payments/gateway", () => ({
  paymentGateway: () => ({ createSubscriptionCheckout: mocks.createCheckout }),
}));
vi.mock("@/lib/payments/stripe", () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: mocks.createPortal } } }),
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST as checkoutPOST } from "../../app/api/payments/checkout/route";

function checkoutRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://bicuni.online/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_checkout_only");
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    mocks.auth.mockResolvedValue({ user: { id: "user-1", email: "student@example.test" } });
    mocks.planFindUnique.mockResolvedValue({
      id: "plan-1",
      slug: "starter",
      name: "Starter",
      priceCents: 200,
      currency: "USD",
      interval: "month",
      active: true,
    });
    mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: null });
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("exige une session authentifiée", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await checkoutPOST(checkoutRequest({ planSlug: "starter" }));
    expect(response.status).toBe(401);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("refuse un plan absent du corps", async () => {
    const response = await checkoutPOST(checkoutRequest({}));
    expect(response.status).toBe(400);
  });

  it("signale Stripe non configuré sans créer de session", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const response = await checkoutPOST(checkoutRequest({ planSlug: "starter" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/pas encore configuré/i),
    });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("refuse un prix client et charge le plan serveur", async () => {
    const response = await checkoutPOST(checkoutRequest({ planSlug: "starter", priceCents: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      planSlug: "starter",
      priceCents: 200,
      userId: "user-1",
    }));
    expect(mocks.createCheckout.mock.calls[0][0]).not.toHaveProperty("priceCents", 1);
  });

  it("ouvre le portail si un abonnement actif existe déjà", async () => {
    mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: "cus_owned" });
    mocks.subscriptionFindFirst.mockResolvedValue({ id: "sub-local" });
    mocks.createPortal.mockResolvedValue({ url: "https://billing.stripe.com/session/test" });
    const response = await checkoutPOST(checkoutRequest({ planSlug: "starter" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/session/test",
      mode: "portal",
    });
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("accepte une clé d’idempotence valide et crée le checkout", async () => {
    const response = await checkoutPOST(checkoutRequest(
      { planSlug: "starter" },
      { "Idempotency-Key": "ui:starter:abc12345" },
    ));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: "https://checkout.stripe.com/c/pay/cs_test",
      mode: "checkout",
    });
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.any(String),
      successUrl: "https://bicuni.online/dashboard/subscription?checkout=success",
      cancelUrl: "https://bicuni.online/pricing?checkout=canceled",
    }));
  });

  it("rejette une clé d’idempotence invalide", async () => {
    const response = await checkoutPOST(checkoutRequest(
      { planSlug: "starter" },
      { "Idempotency-Key": "bad" },
    ));
    expect(response.status).toBe(400);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("ne propage pas une exception Stripe au client", async () => {
    mocks.createCheckout.mockRejectedValue(new Error("Stripe down"));
    const response = await checkoutPOST(checkoutRequest({ planSlug: "starter" }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Impossible de créer la session de paiement.",
    });
  });
});
