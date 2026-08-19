import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), subscription: vi.fn(), invoices: vi.fn(), invoiceCount: vi.fn(), portal: vi.fn(), stripeUpdate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({ db: {
  user: { findUnique: mocks.user }, subscription: { findFirst: mocks.subscription, update: vi.fn() }, invoice: { findMany: mocks.invoices, count: mocks.invoiceCount }, auditLog: { create: vi.fn() },
} }));
vi.mock("@/lib/payments/stripe", () => ({ getStripe: () => ({ billingPortal: { sessions: { create: mocks.portal } }, subscriptions: { update: mocks.stripeUpdate } }) }));
import { POST as portalPOST } from "../../app/api/payments/portal/route";
import { POST as cancelPOST } from "../../app/api/subscriptions/cancel/route";
import { GET as invoicesGET } from "../../app/api/invoices/route";

describe("contrats Stripe utilisateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_contract_only");
    vi.stubEnv("PUBLIC_APP_URL", "https://bicuni.online");
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("APP_URL", "");
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.invoiceCount.mockResolvedValue(0);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("crée le portail uniquement pour le customer appartenant à la session", async () => {
    mocks.user.mockResolvedValue({ stripeCustomerId: "cus_test_owned" }); mocks.portal.mockResolvedValue({ url: "https://billing.stripe.test/session" });
    expect((await portalPOST(new Request("https://bicuni.online/api/payments/portal"))).status).toBe(200);
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    expect(mocks.portal).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_test_owned", return_url: "https://bicuni.online/dashboard/subscription" }));
  });
  it("ne rappelle pas Stripe si l’annulation est déjà programmée", async () => {
    mocks.subscription.mockResolvedValue({ id: "sub-local", userId: "user-1", providerRef: "sub_test", cancelAtPeriodEnd: true });
    const response = await cancelPOST(new Request("https://bicuni.online/api/subscriptions/cancel", {
      method: "POST", body: JSON.stringify({ atPeriodEnd: true }),
    }));
    expect(response.status).toBe(200); expect(mocks.stripeUpdate).not.toHaveBeenCalled();
  });
  it("filtre les factures par propriétaire et borne la pagination", async () => {
    mocks.invoices.mockResolvedValue([]);
    expect((await invoicesGET(new Request("https://bicuni.online/api/invoices?limit=20&page=2"))).status).toBe(200);
    expect(mocks.invoices).toHaveBeenCalledWith(expect.objectContaining({ where: { subscription: { userId: "user-1" } }, skip: 20, take: 20 }));
    expect((await invoicesGET(new Request("https://bicuni.online/api/invoices?limit=500"))).status).toBe(400);
  });

  it("refuse une annulation immédiate et signale Stripe absent", async () => {
    const immediate = await cancelPOST(new Request("https://bicuni.online/api/subscriptions/cancel", {
      method: "POST", body: JSON.stringify({ atPeriodEnd: false }),
    }));
    expect(immediate.status).toBe(400);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const portal = await portalPOST(new Request("https://bicuni.online/api/payments/portal", { method: "POST" }));
    expect(portal.status).toBe(503);
    expect(mocks.portal).not.toHaveBeenCalled();
  });
});
