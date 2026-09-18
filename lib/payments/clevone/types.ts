export const PAYMENT_INTENT_STATUSES = [
  "AWAITING_PAYMENT",
  "PROOF_SUBMITTED",
  "MATCHING",
  "PENDING",
  "REVIEW_REQUIRED",
  "PAID",
  "REJECTED",
  "EXPIRED",
  "REFUNDED",
] as const;

export type PaymentIntentStatusId = (typeof PAYMENT_INTENT_STATUSES)[number];

export type MatchClassId = "STRONG" | "INCOMPLETE" | "VARIANCE" | "REJECT";
export type RiskLevelId = "LOW" | "MEDIUM" | "HIGH";

export type MatchField =
  | "invoiceRef"
  | "providerTxnRef"
  | "amount"
  | "currency"
  | "destination"
  | "payerPhone"
  | "paidAt"
  | "uniqueness"
  | "priorState";

export type FieldComparison = {
  field: MatchField;
  expected: string;
  actual: string;
  matched: boolean;
  weight: "required" | "supporting";
};

export type MatchResult = {
  matchClass: MatchClassId;
  riskLevel: RiskLevelId;
  nextStatus: Exclude<PaymentIntentStatusId, "PROOF_SUBMITTED" | "MATCHING" | "PAID"> | "REVIEW_REQUIRED";
  fields: FieldComparison[];
  reasons: string[];
  financialSourceConnected: boolean;
};

export const INTENT_TTL_MS = 24 * 60 * 60 * 1000;
export const PROOF_RETENTION_MS = 24 * 30 * 24 * 60 * 60 * 1000;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const MAX_PROOFS_PER_INTENT = 5;
export const SIGNED_PROOF_TTL_SECONDS = 5 * 60;
export const ALLOWED_PROOF_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;

export class ClevonePaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code:
      | "AUTH"
      | "VALIDATION"
      | "CONFLICT"
      | "GONE"
      | "FORBIDDEN"
      | "UNCONFIGURED"
      | "DUPLICATE"
      | "UNSUPPORTED",
  ) {
    super(message);
    this.name = "ClevonePaymentError";
  }
}
