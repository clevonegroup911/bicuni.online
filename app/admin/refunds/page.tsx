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
          <p>Les remboursements CLEVONE se traitent depuis le dossier de rapprochement, avec motif et journal d’audit. Stripe n’a pas encore de moteur de remboursement branché.</p>
        </header>
        <RefundBoard configured={REFUND_API_CONTRACT.configured} canReview={false} />
      </div>
    </AdminShell>
  );
}
