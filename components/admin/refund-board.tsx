import { Undo2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RefundRequestForm } from "@/components/admin/refund-request-form";
import { UnconfiguredModule } from "@/components/admin/unconfigured-module";
import { billingStatusClass, billingStatusLabel } from "@/lib/billing/format";
import { REFUND_API_CONTRACT, type RefundView } from "@/lib/billing/contracts";

export function RefundBoard({
  configured,
  items,
  canReview = false,
}: {
  configured: boolean;
  items?: RefundView[];
  canReview?: boolean;
}) {
  if (!configured) {
    return (
      <UnconfiguredModule
        title="Remboursements non configurés"
        description={REFUND_API_CONTRACT.reason}
        contract={REFUND_API_CONTRACT.expectedRoutes}
      />
    );
  }

  return (
    <div className="section-stack">
      {canReview ? <RefundRequestForm /> : null}
      {!items?.length ? (
        <EmptyState
          icon={Undo2}
          title="Aucun remboursement"
          description="Les demandes réellement enregistrées apparaîtront ici."
        />
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Utilisateur</th>
                <th>Montant</th>
                <th>Motif</th>
                <th>Statut</th>
                <th>Demandé le</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.transactionRef}</strong></td>
                  <td>{item.userLabel}</td>
                  <td>{item.amountLabel}</td>
                  <td>{item.reason}</td>
                  <td><span className={billingStatusClass(item.status)}>{billingStatusLabel(item.status)}</span></td>
                  <td>{item.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
