import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/guards";
import { clevonePayments } from "@/lib/payments/clevone/service";
import type { PaymentChannel, PaymentIntentStatus, PaymentRiskLevel } from "@prisma/client";
import { formatMoney } from "@/lib/billing/format";
import { statusLabel } from "@/lib/payments/clevone/locale";

export const metadata = { title: "Rapprochement CLEVONE" };

export default async function ReconciliationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string; currency?: string; risk?: string; q?: string; page?: string }>;
}) {
  const user = await requirePermission("admin:payments:read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await clevonePayments.listAdmin({
    status: params.status as PaymentIntentStatus | undefined,
    channel: params.channel as PaymentChannel | undefined,
    currency: params.currency || undefined,
    riskLevel: params.risk as PaymentRiskLevel | undefined,
    q: params.q,
    page,
  });
  const query = { status: params.status, channel: params.channel, currency: params.currency, risk: params.risk, q: params.q };

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Rapprochement CLEVONE</h1>
          <p>Une preuve client déclenche une vérification. Seul l’état PAID, après double contrôle, active l’abonnement.</p>
        </header>
        <form className="admin-filters" method="get">
          <input className="input" name="q" defaultValue={params.q} placeholder="Référence facture ou fournisseur" />
          <select className="input" name="status" defaultValue={params.status ?? ""}>
            <option value="">Tous les statuts</option>
            {["AWAITING_PAYMENT", "PROOF_SUBMITTED", "MATCHING", "PENDING", "REVIEW_REQUIRED", "PAID", "REJECTED", "EXPIRED", "REFUNDED"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select className="input" name="channel" defaultValue={params.channel ?? ""}>
            <option value="">Tous les canaux</option>
            <option value="MPESA">M-PESA</option>
            <option value="RAWBANK_CDF">RAWBANK CDF</option>
            <option value="RAWBANK_USD">RAWBANK USD</option>
          </select>
          <select className="input" name="currency" defaultValue={params.currency ?? ""}>
            <option value="">Toutes devises</option>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
          <select className="input" name="risk" defaultValue={params.risk ?? ""}>
            <option value="">Tous risques</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <button className="button" type="submit">Filtrer</button>
        </form>
        {result.items.length ? (
          <div className="admin-table-wrap glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Compte</th>
                  <th>Montant</th>
                  <th>Canal</th>
                  <th>Risque</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/admin/reconciliation/${item.publicRef}`}><strong>{item.publicRef}</strong></Link>
                      <small>{item.createdAt.toLocaleString("fr-FR")}</small>
                    </td>
                    <td>{item.user.name ?? item.user.email}</td>
                    <td>{formatMoney(item.amountCents, item.currency)}</td>
                    <td>{item.channel}</td>
                    <td>{item.riskLevel}</td>
                    <td><span className={`admin-status ${item.status.toLowerCase()}`}>{statusLabel(item.status, "fr")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={GitCompareArrows} title="Aucun dossier" description="Les dépôts de preuve CLEVONE apparaîtront ici pour rapprochement." />
        )}
        <Pagination page={result.page} total={result.total} pageSize={result.pageSize} hrefForPage={(next) => buildPageHref("/admin/reconciliation", query, next)} />
      </div>
    </AdminShell>
  );
}
