import { AdminShell } from "@/components/admin/admin-shell";
import { RefundBoard } from "@/components/admin/refund-board";
import { requirePermission } from "@/lib/auth/guards";
import { REFUND_API_CONTRACT } from "@/lib/billing/contracts";

export const metadata = { title: "Remboursements" };

export default async function AdminRefundsPage() {
  const user = await requirePermission("admin:audit:read");
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Remboursements</h1>
          <p>Interface préparée. Aucune demande, approbation ou rejet n’est possible sans back-end réel.</p>
        </header>
        <RefundBoard configured={REFUND_API_CONTRACT.configured} canReview={false} />
      </div>
    </AdminShell>
  );
}
