import { describe, expect, it } from "vitest";
import { matchPayment } from "./matching";

const base = {
  invoiceRef: "CLEV-20260918-TEST",
  submittedInvoiceRef: "CLEV-20260918-TEST",
  expectedAmountCents: 200,
  submittedAmountCents: 200,
  expectedCurrency: "USD",
  submittedCurrency: "USD",
  expectedDestination: "15150-00978276002-01",
  submittedDestination: "15150-00978276002-01",
  submittedPayerPhone: "+243800000001",
  providerTxnRef: "TXN-OK-001",
  paidAtClient: new Date("2026-09-18T12:00:00Z"),
  intentCreatedAt: new Date("2026-09-18T11:00:00Z"),
  intentExpiresAt: new Date("2026-09-19T11:00:00Z"),
  priorStatus: "AWAITING_PAYMENT" as const,
  duplicateProviderRef: false,
  financialSourceConnected: false,
  financialSourceConfirmed: false,
};

describe("rapprochement CLEVONE", () => {
  it("n’active jamais automatiquement sans source financière", () => {
    const result = matchPayment(base);
    expect(result.matchClass).toBe("STRONG");
    expect(result.nextStatus).toBe("REVIEW_REQUIRED");
    expect(result.financialSourceConnected).toBe(false);
  });

  it("classe un montant incorrect en VARIANCE", () => {
    const result = matchPayment({ ...base, submittedAmountCents: 1 });
    expect(result.matchClass).toBe("VARIANCE");
    expect(result.nextStatus).toBe("REVIEW_REQUIRED");
  });

  it("rejette un mauvais compte", () => {
    const result = matchPayment({ ...base, submittedDestination: "00000-00000000000-00" });
    expect(result.matchClass).toBe("REJECT");
    expect(result.nextStatus).toBe("REJECTED");
  });

  it("rejette un doublon de référence fournisseur", () => {
    const result = matchPayment({ ...base, duplicateProviderRef: true });
    expect(result.matchClass).toBe("REJECT");
    expect(result.nextStatus).toBe("REJECTED");
  });

  it("classe une référence absente en INCOMPLETE", () => {
    const result = matchPayment({ ...base, providerTxnRef: "" });
    expect(result.matchClass).toBe("INCOMPLETE");
    expect(result.nextStatus).toBe("PENDING");
  });

  it("détecte une mauvaise devise", () => {
    const result = matchPayment({ ...base, submittedCurrency: "CDF" });
    expect(result.matchClass).toBe("VARIANCE");
  });
});
