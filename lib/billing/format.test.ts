import { describe, expect, it } from "vitest";
import {
  billingStatusLabel,
  formatBillingDate,
  formatMoney,
  invoiceAmountCents,
  planIntervalLabel,
} from "./format";

describe("formatage facturation", () => {
  it("formate un montant réel en devise ISO", () => {
    expect(formatMoney(200, "USD")).toMatch(/2/);
    expect(formatMoney(0, "EUR")).toMatch(/0/);
  });

  it("préfère le montant payé s’il existe", () => {
    expect(invoiceAmountCents({ amountPaidCents: 700, amountDueCents: 900 })).toBe(700);
    expect(invoiceAmountCents({ amountPaidCents: 0, amountDueCents: 900 })).toBe(900);
  });

  it("traduit les statuts connus sans inventer un succès", () => {
    expect(billingStatusLabel("PAST_DUE")).toBe("Impayé");
    expect(billingStatusLabel("unknown-status")).toBe("unknown-status");
    expect(planIntervalLabel("month")).toBe("mois");
  });

  it("reste lisible si la date est absente", () => {
    expect(formatBillingDate(null)).toBe("—");
    expect(formatBillingDate("not-a-date")).toBe("—");
  });
});
