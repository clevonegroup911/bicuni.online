import { describe, expect, it } from "vitest";
import {
  COUPON_API_CONTRACT,
  REFUND_API_CONTRACT,
  STRIPE_PORTAL_CONTRACT,
  SUBSCRIPTION_CANCEL_CONTRACT,
  stripeConfiguredFromEnv,
} from "./contracts";

describe("contrats financiers UI", () => {
  it("déclare coupons et remboursements non configurés tant que Prisma n’a pas les modèles", () => {
    expect(COUPON_API_CONTRACT.configured).toBe(false);
    expect(REFUND_API_CONTRACT.configured).toBe(false);
    expect(COUPON_API_CONTRACT.expectedRoutes.some((item) => item.includes("/api/admin/coupons"))).toBe(true);
    expect(REFUND_API_CONTRACT.expectedRoutes.some((item) => item.includes("/api/admin/refunds"))).toBe(true);
  });

  it("pointe le portail et l’annulation vers les routes Codex, sans URL fabriquée", () => {
    expect(STRIPE_PORTAL_CONTRACT.path).toBe("/api/payments/portal");
    expect(STRIPE_PORTAL_CONTRACT.success).toContain("url");
    expect(SUBSCRIPTION_CANCEL_CONTRACT.path).toBe("/api/subscriptions/cancel");
    expect(SUBSCRIPTION_CANCEL_CONTRACT.body).toEqual({ atPeriodEnd: true });
  });

  it("détecte Stripe uniquement si la clé secrète est réellement définie", () => {
    expect(stripeConfiguredFromEnv("")).toBe(false);
    expect(stripeConfiguredFromEnv("   ")).toBe(false);
    expect(stripeConfiguredFromEnv(undefined)).toBe(false);
    expect(stripeConfiguredFromEnv("sk_test_placeholder")).toBe(true);
  });
});
