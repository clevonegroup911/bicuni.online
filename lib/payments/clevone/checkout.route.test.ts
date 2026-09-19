import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createCheckout: vi.fn(),
  deny: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/rate-limit", () => ({
  denyIfRateLimited: mocks.deny,
  requestIdentity: () => "203.0.113.10",
}));
vi.mock("@/lib/payments/clevone/service", () => ({
  clevonePayments: { createCheckout: mocks.createCheckout },
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../../../app/api/payments/clevone/checkout/route";

describe("POST /api/payments/clevone/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    mocks.auth.mockResolvedValue({ user: { id: "user-1", email: "qa@example.test" } });
    mocks.createCheckout.mockResolvedValue({ publicRef: "CLEV-20260918-TEST", reused: false });
  });

  it("refuse une origine tierce", async () => {
    const response = await POST(new Request("https://bicuni.online/api/payments/clevone/checkout", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ planSlug: "starter", channel: "RAWBANK_USD" }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("crée une facture et renvoie une URL interne", async () => {
    const response = await POST(new Request("https://bicuni.online/api/payments/clevone/checkout", {
      method: "POST",
      headers: { origin: "https://bicuni.online", "content-type": "application/json", "Idempotency-Key": "idem-abc-12345" },
      body: JSON.stringify({ planSlug: "starter", channel: "RAWBANK_USD" }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: "/pay/CLEV-20260918-TEST",
      publicRef: "CLEV-20260918-TEST",
    });
  });
});
