import { describe, expect, it } from "vitest";
import { quoteChannelAmount } from "./amount";

const rate = {
  rateId: "rate-test",
  pair: "USD_CDF" as const,
  rateUnits: 2850,
  source: "TEST",
  effectiveAt: new Date("2026-09-18T12:00:00.000Z"),
  expiresAt: null,
};

describe("montants CLEVONE", () => {
  it("conserve le USD pour RAWBANK USD sans taux", () => {
    expect(quoteChannelAmount({ priceCents: 200, currency: "USD", channel: "RAWBANK_USD" })).toMatchObject({
      amountCents: 200,
      currency: "USD",
      fx: null,
    });
  });

  it("refuse CDF sans taux approuvé et n’invente aucun défaut", () => {
    expect(() => quoteChannelAmount({ priceCents: 200, currency: "USD", channel: "MPESA" })).toThrow(/aucun taux USD\/CDF/);
  });

  it("convertit via le taux figé fourni uniquement", () => {
    expect(quoteChannelAmount({ priceCents: 200, currency: "USD", channel: "RAWBANK_CDF", usdCdfRate: rate })).toMatchObject({
      amountCents: 570000,
      currency: "CDF",
      fx: rate,
    });
  });
});
