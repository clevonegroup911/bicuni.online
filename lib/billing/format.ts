const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  PAST_DUE: "Impayé",
  CANCELED: "Annulé",
  INCOMPLETE: "Incomplet",
  EXPIRED: "Expiré",
  SUCCEEDED: "Réussi",
  FAILED: "Échoué",
  paid: "Payée",
  open: "Ouverte",
  draft: "Brouillon",
  void: "Annulée",
  uncollectible: "Irrécouvrable",
};

const INTERVAL_LABELS: Record<string, string> = {
  day: "jour",
  week: "semaine",
  month: "mois",
  year: "an",
};

export function formatMoney(cents: number, currency: string) {
  const code = currency.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

export function formatBillingDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
}

export function formatBillingDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR");
}

export function billingStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function billingStatusClass(status: string) {
  return `admin-status ${status.toLowerCase()}`;
}

export function planIntervalLabel(interval: string) {
  return INTERVAL_LABELS[interval] ?? interval;
}

export function invoiceAmountCents(invoice: { amountPaidCents: number; amountDueCents: number }) {
  return invoice.amountPaidCents || invoice.amountDueCents;
}
