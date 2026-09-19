import { accountsMatch } from "./accounts";
import type { FieldComparison, MatchClassId, MatchResult, PaymentIntentStatusId, RiskLevelId } from "./types";

export type MatchingInput = {
  invoiceRef: string;
  submittedInvoiceRef: string;
  expectedAmountCents: number;
  submittedAmountCents: number;
  expectedCurrency: string;
  submittedCurrency: string;
  expectedDestination: string;
  submittedDestination: string;
  expectedChannelPhone?: string;
  submittedPayerPhone: string;
  providerTxnRef: string;
  paidAtClient: Date;
  intentCreatedAt: Date;
  intentExpiresAt: Date;
  priorStatus: PaymentIntentStatusId;
  duplicateProviderRef: boolean;
  financialSourceConnected: boolean;
  financialSourceConfirmed: boolean;
};

function field(fieldName: FieldComparison["field"], expected: string, actual: string, matched: boolean, weight: FieldComparison["weight"]): FieldComparison {
  return { field: fieldName, expected, actual, matched, weight };
}

function normalizeRef(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function financialSourceConnectedFromEnv() {
  return process.env.CLEVONE_FINANCIAL_SOURCE === "connected";
}

export function matchPayment(input: MatchingInput): MatchResult {
  const reasons: string[] = [];
  const fields: FieldComparison[] = [
    field("invoiceRef", input.invoiceRef, input.submittedInvoiceRef, normalizeRef(input.invoiceRef) === normalizeRef(input.submittedInvoiceRef), "required"),
    field("providerTxnRef", "présent", input.providerTxnRef || "", Boolean(input.providerTxnRef.trim()), "required"),
    field("amount", String(input.expectedAmountCents), String(input.submittedAmountCents), input.expectedAmountCents === input.submittedAmountCents, "required"),
    field("currency", input.expectedCurrency, input.submittedCurrency, input.expectedCurrency.toUpperCase() === input.submittedCurrency.toUpperCase(), "required"),
    field("destination", input.expectedDestination, input.submittedDestination, accountsMatch(input.expectedDestination, input.submittedDestination), "required"),
    field("payerPhone", input.expectedChannelPhone ?? "fourni", input.submittedPayerPhone, Boolean(normalizePhone(input.submittedPayerPhone)), "supporting"),
    field("paidAt", input.intentCreatedAt.toISOString(), input.paidAtClient.toISOString(), input.paidAtClient >= input.intentCreatedAt && input.paidAtClient <= input.intentExpiresAt, "supporting"),
    field("uniqueness", "unique", input.providerTxnRef, !input.duplicateProviderRef, "required"),
    field("priorState", input.priorStatus, input.priorStatus, input.priorStatus !== "PAID" && input.priorStatus !== "REFUNDED", "required"),
  ];

  const missingRequired = fields.filter((item) => item.weight === "required" && !item.matched);
  const amountGap = Math.abs(input.submittedAmountCents - input.expectedAmountCents);
  const destinationOk = fields.find((item) => item.field === "destination")?.matched === true;
  const currencyOk = fields.find((item) => item.field === "currency")?.matched === true;
  const refOk = fields.find((item) => item.field === "invoiceRef")?.matched === true;

  if (input.duplicateProviderRef) reasons.push("Référence fournisseur déjà utilisée.");
  if (!destinationOk) reasons.push("Compte destinataire incorrect.");
  if (!currencyOk) reasons.push("Devise incorrecte.");
  if (amountGap > 0) reasons.push("Montant différent de la facture.");
  if (!refOk) reasons.push("Référence de facture divergente.");
  if (input.priorStatus === "PAID" || input.priorStatus === "REFUNDED") reasons.push("État antérieur incompatible.");

  let matchClass: MatchClassId;
  if (!destinationOk || input.duplicateProviderRef || input.priorStatus === "PAID" || (!input.providerTxnRef.trim() && amountGap > 0 && !currencyOk)) {
    matchClass = !destinationOk || input.duplicateProviderRef || input.priorStatus === "PAID" ? "REJECT" : "VARIANCE";
  } else if (missingRequired.some((item) => item.field === "providerTxnRef" || item.field === "invoiceRef") || !input.submittedPayerPhone.trim()) {
    matchClass = "INCOMPLETE";
  } else if (!currencyOk || amountGap > 0 || !refOk) {
    matchClass = "VARIANCE";
  } else if (missingRequired.length === 0 && fields.filter((item) => item.weight === "supporting" && !item.matched).length === 0) {
    matchClass = "STRONG";
  } else if (missingRequired.length === 0) {
    matchClass = "STRONG";
  } else {
    matchClass = "INCOMPLETE";
  }

  if (matchClass === "REJECT" && !destinationOk) {
    reasons.push("Transaction rejetée : compte incorrect ou preuve incompatible.");
  }

  const riskLevel: RiskLevelId = matchClass === "REJECT" || matchClass === "VARIANCE"
    ? "HIGH"
    : matchClass === "INCOMPLETE"
      ? "MEDIUM"
      : "LOW";

  let nextStatus: MatchResult["nextStatus"];
  if (matchClass === "REJECT") nextStatus = "REJECTED";
  else if (matchClass === "INCOMPLETE") nextStatus = "PENDING";
  else nextStatus = "REVIEW_REQUIRED";

  if (matchClass === "STRONG" && input.financialSourceConnected && input.financialSourceConfirmed) {
    reasons.push("Source financière fiable confirmée — la confirmation humaine reste obligatoire tant que le double contrôle n’est pas levé.");
  }
  if (!input.financialSourceConnected) {
    reasons.push("Aucune API officielle M-PESA/RAWBANK n’est connectée : validation humaine à double contrôle obligatoire avant PAID.");
  }

  return {
    matchClass,
    riskLevel,
    nextStatus,
    fields,
    reasons,
    financialSourceConnected: input.financialSourceConnected,
  };
}
