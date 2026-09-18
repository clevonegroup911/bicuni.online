export type PayLocale = "fr" | "en";

const fr = {
  proofNotPaid: "Preuve soumise ≠ paiement confirmé. L’activation attend une confirmation financière ou une validation humaine à double contrôle.",
  awaiting: "En attente de paiement",
  proofSubmitted: "Preuve reçue — vérification en cours",
  matching: "Rapprochement en cours",
  pending: "Données incomplètes — nouvelle tentative possible pendant 24 h",
  review: "Contrôle humain requis",
  paid: "Payé et acquitté",
  rejected: "Rejeté",
  expired: "Expiré",
  refunded: "Remboursé",
  copy: "Copier",
  copied: "Copié",
  invoicePending: "Facture en attente",
  invoicePaid: "Facture acquittée",
};

const en: typeof fr = {
  proofNotPaid: "Submitted proof ≠ confirmed payment. Activation waits for a reliable financial source or dual human approval.",
  awaiting: "Awaiting payment",
  proofSubmitted: "Proof received — verification in progress",
  matching: "Matching in progress",
  pending: "Incomplete data — retry possible for 24 hours",
  review: "Human review required",
  paid: "Paid",
  rejected: "Rejected",
  expired: "Expired",
  refunded: "Refunded",
  copy: "Copy",
  copied: "Copied",
  invoicePending: "Invoice pending",
  invoicePaid: "Paid invoice",
};

export function payLocale(value?: string | null): PayLocale {
  return value?.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function payCopy(locale: PayLocale) {
  return locale === "en" ? en : fr;
}

export function statusLabel(status: string, locale: PayLocale) {
  const copy = payCopy(locale);
  const map: Record<string, string> = {
    AWAITING_PAYMENT: copy.awaiting,
    PROOF_SUBMITTED: copy.proofSubmitted,
    MATCHING: copy.matching,
    PENDING: copy.pending,
    REVIEW_REQUIRED: copy.review,
    PAID: copy.paid,
    REJECTED: copy.rejected,
    EXPIRED: copy.expired,
    REFUNDED: copy.refunded,
  };
  return map[status] ?? status;
}
