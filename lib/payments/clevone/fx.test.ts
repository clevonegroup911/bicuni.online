import { describe, expect, it } from "vitest";
import { convertUsdCentsToCdfCents, publicFxLabel } from "./fx";

describe("taux USD/CDF", () => {
  it("arrondit par Math.round sans taux inventé", () => {
    expect(convertUsdCentsToCdfCents(200, 2850)).toBe(570_000);
    expect(convertUsdCentsToCdfCents(1, 2850)).toBe(2850);
    expect(convertUsdCentsToCdfCents(199, 3)).toBe(597);
  });

  it("refuse un taux hors bornes", () => {
    expect(() => convertUsdCentsToCdfCents(200, 0)).toThrow(/Taux/);
    expect(() => convertUsdCentsToCdfCents(200, 50_001)).toThrow(/Taux/);
  });

  it("affiche source et date d’effet", () => {
    const label = publicFxLabel({
      rateId: "rate-1",
      pair: "USD_CDF",
      rateUnits: 2850,
      source: "saisie administrative TEST",
      effectiveAt: new Date("2026-09-18T12:00:00.000Z"),
      expiresAt: null,
    }, "fr");
    expect(label).toContain("1 USD = 2850 CDF");
    expect(label).toContain("saisie administrative TEST");
    expect(label).toContain("2026-09-18T12:00:00.000Z");
  });
});
