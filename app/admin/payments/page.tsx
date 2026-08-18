import { WalletCards } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata = { title: "Transactions" };

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePermission("admin:audit:read");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const pageSize = 25;
  const [items, total, invoices] = await Promise.all([
    db.payment.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.payment.count(),
    db.invoice.findMany({
      include: { subscription: { include: { user: { select: { email: true } }, plan: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Transactions</h1>
          <p>Paiements et factures réellement enregistrés. Un succès n’est jamais simulé depuis l’interface.</p>
        </header>
        {items.length ? (
          <div className="admin-table-wrap glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Compte</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.createdAt.toLocaleString("fr-FR")}</td>
                    <td>{item.user.name ?? item.user.email}</td>
                    <td>{money(item.amountCents, item.currency)}</td>
                    <td><span className={`admin-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    <td>{item.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={WalletCards} title="Aucune transaction" description="Les encaissements confirmés par webhook apparaîtront ici." />
        )}
        <Pagination page={page} total={total} pageSize={pageSize} hrefForPage={(next) => buildPageHref("/admin/payments", {}, next)} />

        <section className="glass card admin-panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <h2>Factures récentes</h2>
            <Link className="auth-link" href="/admin/invoices">Toutes les factures</Link>
          </div>
          {invoices.length ? invoices.map((invoice) => (
            <div className="admin-row" key={invoice.id}>
              <span>
                <strong>{invoice.number ?? invoice.providerRef}</strong>
                <small>{invoice.subscription.user.email} · {invoice.subscription.plan.name} · {invoice.status}</small>
              </span>
              <span>{money(invoice.amountDueCents, invoice.currency)}</span>
            </div>
          )) : <p className="muted">Aucune facture n’est encore disponible.</p>}
        </section>
      </div>
    </AdminShell>
  );
}
