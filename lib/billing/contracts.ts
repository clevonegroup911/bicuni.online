export const STRIPE_PORTAL_PATH = "/api/payments/portal";
export const SUBSCRIPTION_CANCEL_PATH = "/api/subscriptions/cancel";
export const ADMIN_COUPONS_PATH = "/api/admin/coupons";
export const ADMIN_REFUNDS_PATH = "/api/admin/refunds";

export const STRIPE_PORTAL_CONTRACT = {
  method: "POST",
  path: STRIPE_PORTAL_PATH,
  auth: "session utilisateur ACTIVE",
  body: { returnUrl: "string optionnelle, défaut /dashboard/subscription" },
  success: "200 { url: string } — URL Stripe Billing Portal, jamais inventée côté client",
  errors: {
    401: "session expirée",
    404: "aucun client Stripe pour ce compte, ou route absente",
    501: "portail non implémenté",
    503: "STRIPE_SECRET_KEY absente",
  },
} as const;

export const SUBSCRIPTION_CANCEL_CONTRACT = {
  method: "POST",
  path: SUBSCRIPTION_CANCEL_PATH,
  auth: "session utilisateur ACTIVE, propriétaire de l’abonnement",
  body: { atPeriodEnd: true },
  success: "200 { subscription: { id, status, cancelAtPeriodEnd, currentPeriodEnd } }",
  notes: [
    "Annulation en fin de période uniquement (pas d’annulation immédiate simulée).",
    "Le serveur doit appeler Stripe puis refléter cancelAtPeriodEnd.",
    "Aucun paiement ni remboursement ne doit être fabriqué par l’UI.",
  ],
} as const;

export const COUPON_API_CONTRACT = {
  configured: false,
  reason: "Aucun modèle Prisma Coupon. Aucune route /api/admin/coupons.",
  expectedModel: [
    "code",
    "type (percent | amount)",
    "valueCents ou percentOff",
    "currency?",
    "validFrom",
    "validUntil",
    "maxRedemptions",
    "redeemedCount",
    "status (ACTIVE | DISABLED)",
    "createdAt",
  ],
  expectedRoutes: [
    "GET /api/admin/coupons — liste paginée, permission admin:audit:read",
    "POST /api/admin/coupons — création, permission administrative financière à définir par Codex",
    "POST /api/admin/coupons/:id/disable — désactivation, jamais de suppression silencieuse",
  ],
} as const;

export const REFUND_API_CONTRACT = {
  configured: false,
  reason: "Aucun modèle Prisma Refund. Aucune route /api/admin/refunds.",
  expectedModel: [
    "paymentId / transaction providerRef",
    "userId",
    "amountCents",
    "currency",
    "reason",
    "status (REQUESTED | APPROVED | REJECTED | PROCESSED)",
    "requestedById",
    "reviewedById",
    "reviewedAt",
    "providerRefundRef",
  ],
  expectedRoutes: [
    "GET /api/admin/refunds — historique paginé, permission admin:audit:read",
    "POST /api/admin/refunds — demande liée à un Payment existant",
    "POST /api/admin/refunds/:id/approve — Stripe refund réel, idempotent",
    "POST /api/admin/refunds/:id/reject — motif obligatoire",
  ],
} as const;

export function stripeConfiguredFromEnv(secretKey = process.env.STRIPE_SECRET_KEY) {
  return Boolean(secretKey?.trim());
}

export type CouponView = {
  id: string;
  code: string;
  type: "percent" | "amount";
  valueLabel: string;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  status: "ACTIVE" | "DISABLED";
};

export type RefundView = {
  id: string;
  transactionRef: string;
  userLabel: string;
  amountLabel: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED";
  createdAt: string;
};
