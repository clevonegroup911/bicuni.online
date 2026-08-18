import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ManageSubscription } from "@/components/subscriptions/manage-subscription";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { getCurrentSubscription } from "@/lib/subscriptions/service";
import { stripeConfiguredFromEnv } from "@/lib/billing/contracts";
import {
  billingStatusClass,
  billingStatusLabel,
  formatBillingDate,
  formatMoney,
  planIntervalLabel,
} from "@/lib/billing/format";

export const metadata: Metadata = { title: "Abonnement" };

export default async function SubscriptionPage() {
  const user = await requireUser();
  const stripeConfigured = stripeConfiguredFromEnv();
  const [subscription, history, payments, invoices] = await Promise.all([
    getCurrentSubscription(user.id),
    db.subscription.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.invoice.findMany({
      where: { subscription: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const current = subscription ?? history.find((item) => item.status === "PAST_DUE") ?? null;

  return (
    <div>
      <DashboardHeader
        eyebrow="Facturation"
        title="Abonnement."
        description="Statut réel de votre accès. Un paiement n’est jamais simulé depuis cette page."
        actions={<Link className="button" href="/pricing">Changer de plan</Link>}
      />
      <div className="section-stack">
        {current ? (
          <section className="glass card admin-panel">
            <h2>{current.plan.name}</h2>
            <dl className="profile-dl">
              <dt>Tarif</dt>
              <dd>{formatMoney(current.plan.priceCents, current.plan.currency)} / {planIntervalLabel(current.plan.interval)}</dd>
              <dt>Devise</dt>
              <dd>{current.plan.currency}</dd>
              <dt>Périodicité</dt>
              <dd>{planIntervalLabel(current.plan.interval)}</dd>
              <dt>Statut</dt>
              <dd><span className={billingStatusClass(current.status)}>{billingStatusLabel(current.status)}</span></dd>
              <dt>Prochaine échéance</dt>
              <dd>
                {current.cancelAtPeriodEnd
                  ? `Annulation prévue le ${formatBillingDate(current.currentPeriodEnd)}`
                  : formatBillingDate(current.currentPeriodEnd)}
              </dd>
              <dt>Annulation programmée</dt>
              <dd>{current.cancelAtPeriodEnd ? "Oui — accès conservé jusqu’à l’échéance" : "Non"}</dd>
            </dl>
            <div className="stack-top">
              <ManageSubscription
                stripeConfigured={stripeConfigured}
                canCancel={current.status === "ACTIVE" || current.status === "PAST_DUE"}
                cancelScheduled={current.cancelAtPeriodEnd}
              />
            </div>
          </section>
        ) : (
          <EmptyState
            icon={CreditCard}
            title="Aucun abonnement actif"
            description="Un plan est nécessaire pour publier et accéder à l’espace académique."
            action={<Link className="button" href="/pricing">Voir les plans</Link>}
          />
        )}

        {!current && !stripeConfigured ? (
          <p className="form-error billing-banner" role="status">
            Stripe n’est pas configuré sur ce serveur. Le paiement en ligne est indisponible tant que les clés fournisseur ne sont pas définies.
          </p>
        ) : null}

        <section className="glass card admin-panel">
          <div className="panel-head">
            <h2>Factures récentes</h2>
            <Link className="auth-link" href="/dashboard/invoices">Historique complet</Link>
          </div>
          <InvoiceTable embedded invoices={invoices} />
        </section>

        <section className="glass card admin-panel">
          <h2>Historique des abonnements</h2>
          {history.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Statut</th>
                    <th>Échéance</th>
                    <th>Annulation</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.plan.name}</strong>
                        <small>{formatMoney(item.plan.priceCents, item.plan.currency)} / {planIntervalLabel(item.plan.interval)}</small>
                      </td>
                      <td><span className={billingStatusClass(item.status)}>{billingStatusLabel(item.status)}</span></td>
                      <td>{formatBillingDate(item.currentPeriodEnd)}</td>
                      <td>{item.cancelAtPeriodEnd ? "Fin de période" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Aucun historique d’abonnement pour ce compte.</p>}
        </section>

        <section className="glass card admin-panel">
          <h2>Transactions</h2>
          {payments.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Date</th><th>Montant</th><th>Statut</th><th>Fournisseur</th></tr></thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.createdAt.toLocaleString("fr-FR")}</td>
                      <td>{formatMoney(payment.amountCents, payment.currency)}</td>
                      <td><span className={billingStatusClass(payment.status)}>{billingStatusLabel(payment.status)}</span></td>
                      <td>{payment.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Aucune transaction enregistrée.</p>}
        </section>
      </div>
    </div>
  );
}
