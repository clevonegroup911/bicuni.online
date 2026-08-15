import { CreditCard } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata = { title: "Abonnements" };

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePermission("admin:audit:read");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const pageSize = 25;
  const [items, total] = await Promise.all([
    db.subscription.findMany({
      include: { user: { select: { email: true, name: true } }, plan: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.subscription.count(),
  ]);

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Abonnements</h1>
          <p>{total} abonnement{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""} en base. Aucun statut n’est inventé.</p>
        </header>
        {items.length ? (
          <div className="admin-table-wrap glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Compte</th>
                  <th>Plan</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                  <th>Annulation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.user.name ?? item.user.email}</strong><small>{item.user.email}</small></td>
                    <td>{item.plan.name}</td>
                    <td><span className={`admin-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    <td>{item.currentPeriodEnd?.toLocaleDateString("fr-FR") ?? "—"}</td>
                    <td>{item.cancelAtPeriodEnd ? "Fin de période" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={CreditCard} title="Aucun abonnement" description="Les abonnements confirmés par le prestataire de paiement apparaîtront ici." />
        )}
        <Pagination page={page} total={total} pageSize={pageSize} hrefForPage={(next) => buildPageHref("/admin/subscriptions", {}, next)} />
      </div>
    </AdminShell>
  );
}
