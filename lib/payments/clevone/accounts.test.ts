import { afterEach, describe, expect, it } from "vitest";
import { accountsMatch, getClevoneAccounts } from "./accounts";

describe("comptes CLEVONE", () => {
  afterEach(() => {
    delete process.env.CLEVONE_MPESA_MSISDN;
    delete process.env.CLEVONE_RAWBANK_USD;
  });

  it("centralise les coordonnées officielles validées", () => {
    const accounts = getClevoneAccounts();
    expect(accounts.holder).toBe("CLEVONE JEAMSON EROISH");
    expect(accounts.destinations.MPESA.account).toBe("+243 828 320 130");
    expect(accounts.destinations.RAWBANK_CDF.account).toBe("15150-00978276003-95");
    expect(accounts.destinations.RAWBANK_USD.account).toBe("15150-00978276002-01");
    expect(accounts.swift).toBe("RAWBCDKI");
  });

  it("refuse un numéro M-PESA invalide", () => {
    process.env.CLEVONE_MPESA_MSISDN = "123";
    expect(() => getClevoneAccounts()).toThrow(/M-PESA/);
  });

  it("compare les comptes sans espaces", () => {
    expect(accountsMatch("15150-00978276002-01", "15150 00978276002 01")).toBe(true);
  });
});
