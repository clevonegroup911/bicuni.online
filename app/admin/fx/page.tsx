import { AdminShell } from "@/components/admin/admin-shell";
import { FxRateAdmin } from "@/components/admin/fx-rate-admin";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata = { title: "Taux USD/CDF" };

export default async function AdminFxPage() {
  const user = await requirePermission("admin:payments:read");
  const rates = await db.fxRate.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      rateUnits: true,
      source: true,
      effectiveAt: true,
      expiresAt: true,
      status: true,
      enteredById: true,
      approvedById: true,
    },
  });
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Taux USD/CDF</h1>
          <p>Aucun taux n’est inventé. Un taux proposé par un administrateur doit être approuvé par un autre. Les factures déjà émises conservent le taux figé à la création.</p>
        </header>
        <FxRateAdmin initialRates={rates.map((rate) => ({
          ...rate,
          effectiveAt: rate.effectiveAt.toISOString(),
          expiresAt: rate.expiresAt?.toISOString() ?? null,
        }))} />
      </div>
    </AdminShell>
  );
}
