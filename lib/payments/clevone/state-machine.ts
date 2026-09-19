import type { PaymentIntentStatusId } from "./types";

const TRANSITIONS: Record<PaymentIntentStatusId, readonly PaymentIntentStatusId[]> = {
  AWAITING_PAYMENT: ["PROOF_SUBMITTED", "EXPIRED"],
  PROOF_SUBMITTED: ["MATCHING"],
  MATCHING: ["PENDING", "REVIEW_REQUIRED", "REJECTED"],
  PENDING: ["PROOF_SUBMITTED", "MATCHING", "REVIEW_REQUIRED", "REJECTED", "EXPIRED"],
  REVIEW_REQUIRED: ["PENDING", "PAID", "REJECTED"],
  PAID: ["REFUNDED"],
  REJECTED: ["PROOF_SUBMITTED", "EXPIRED"],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransition(from: PaymentIntentStatusId, to: PaymentIntentStatusId) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PaymentIntentStatusId, to: PaymentIntentStatusId) {
  if (!canTransition(from, to)) {
    throw new Error(`Transition de paiement interdite : ${from} → ${to}.`);
  }
}

export function canActivate(status: PaymentIntentStatusId) {
  return status === "PAID";
}

export function isTerminal(status: PaymentIntentStatusId) {
  return status === "EXPIRED" || status === "REFUNDED";
}

export function isOpenForProof(status: PaymentIntentStatusId) {
  return status === "AWAITING_PAYMENT" || status === "REJECTED" || status === "PENDING";
}

export function allowedTransitions(from: PaymentIntentStatusId) {
  return TRANSITIONS[from];
}
