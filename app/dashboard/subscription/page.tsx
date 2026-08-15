import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { getCurrentSubscription } from "@/lib/subscriptions/service";
import { formatPlanPrice } from "@/lib/subscriptions/catalog";

export const metadata: Metadata = { title: "Abonnement" };

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

export default async function SubscriptionPage() {
  const user = await requireUser();
  const [subscription, payments, invoices] = await Promise.all([
    getCurrentSubscription(user.id),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.invoice.findMany({
      where: { subscription: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <div>
      <DashboardHeader
        eyebrow="Facturation"
        title="Abonnement."
        description="Statut réel de votre accès. Un paiement n’est jamais simulé depuis cette page."
        actions={<Link className="button" href="/pricing">Changer de plan</Link>}
      />
      <div className="section-stack">
      {subscription ? (
        <section className="glass card admin-panel">
          <h2>{subscription.plan.name}</h2>
          <dl className="profile-dl">
            <dt>Prix</dt>
            <dd>{formatPlanPrice(subscription.plan.priceCents)} / {subscription.plan.interval === "year" ? "an" : "mois"}</dd>
            <dt>Devise</dt>
            <dd>{subscription.plan.currency}</dd>
            <dt>Statut</dt>
            <dd>{subscription.status}</dd>
            <dt>Renouvellement</dt>
            <dd>
              {subscription.cancelAtPeriodEnd
                ? "Annulation prévue en fin de période"
                : subscription.currentPeriodEnd
                  ? `Prochaine échéance le ${subscription.currentPeriodEnd.toLocaleDateString("fr-FR")}`
                  : "Non renseigné"}
            </dd>
            <dt>Annulation</dt>
            <dd>L’annulation en libre-service n’est pas encore disponible. Écrivez à <a className="auth-link" href="mailto:support@bicuni.online">support@bicuni.online</a>.</dd>
          </dl>
        </section>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="Aucun abonnement actif"
          description="Un plan est nécessaire pour publier et accéder à l’espace académique."
          action={<Link className="button" href="/pricing">Voir les plans</Link>}
        />
      )}

      <section className="glass card admin-panel">
        <h2>Factures</h2>
        {invoices.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Numéro</th><th>Montant</th><th>Statut</th><th>Période</th><th></th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.number ?? invoice.providerRef}</td>
                    <td>{money(invoice.amountPaidCents || invoice.amountDueCents, invoice.currency)}</td>
                    <td><span className={`admin-status ${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                    <td>{invoice.periodEnd ? invoice.periodEnd.toLocaleDateString("fr-FR") : "—"}</td>
                    <td>{invoice.hostedUrl ? <a className="auth-link" href={invoice.hostedUrl}>Ouvrir</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Aucune facture n’est encore disponible pour ce compte.</p>}
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
                    <td>{money(payment.amountCents, payment.currency)}</td>
                    <td><span className={`admin-status ${payment.status.toLowerCase()}`}>{payment.status}</span></td>
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
