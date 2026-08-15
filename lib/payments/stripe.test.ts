import { describe, expect, it } from "vitest";
import { stripeRecurringPrice } from "./stripe";

describe("stripeRecurringPrice", () => {
  it("utilise le montant, la devise et l’intervalle définis côté serveur", () => {
    expect(stripeRecurringPrice({ priceCents: 200, currency: "USD", interval: "month" })).toEqual({
      currency: "usd",
      unit_amount: 200,
      recurring: { interval: "month" },
    });
  });

  it("refuse un montant non positif", () => {
    expect(() => stripeRecurringPrice({ priceCents: 0, currency: "USD", interval: "month" })).toThrow(/positif/);
  });

  it("refuse une devise ou un intervalle non pris en charge", () => {
    expect(() => stripeRecurringPrice({ priceCents: 200, currency: "US", interval: "month" })).toThrow(/devise/);
    expect(() => stripeRecurringPrice({ priceCents: 200, currency: "USD", interval: "quarter" })).toThrow(/intervalle/);
  });
});
