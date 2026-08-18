import { TicketPercent } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CouponForm } from "@/components/admin/coupon-form";
import { UnconfiguredModule } from "@/components/admin/unconfigured-module";
import { billingStatusClass, billingStatusLabel } from "@/lib/billing/format";
import { COUPON_API_CONTRACT, type CouponView } from "@/lib/billing/contracts";

export function CouponBoard({
  configured,
  items,
  canManage = false,
}: {
  configured: boolean;
  items?: CouponView[];
  canManage?: boolean;
}) {
  if (!configured) {
    return (
      <UnconfiguredModule
        title="Coupons non configurés"
        description={COUPON_API_CONTRACT.reason}
        contract={COUPON_API_CONTRACT.expectedRoutes}
      />
    );
  }

  return (
    <div className="section-stack">
      {canManage ? <CouponForm /> : null}
      {!items?.length ? (
        <EmptyState
          icon={TicketPercent}
          title="Aucun coupon"
          description="Les codes promotionnels réellement créés apparaîtront ici."
        />
      ) : (
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Valeur</th>
                <th>Validité</th>
                <th>Utilisations</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.code}</strong></td>
                  <td>{item.type === "percent" ? "Pourcentage" : "Montant"}</td>
                  <td>{item.valueLabel}</td>
                  <td>{item.validFrom || item.validUntil ? `${item.validFrom ?? "—"} → ${item.validUntil ?? "—"}` : "—"}</td>
                  <td>{item.maxRedemptions == null ? `${item.redeemedCount}` : `${item.redeemedCount} / ${item.maxRedemptions}`}</td>
                  <td><span className={billingStatusClass(item.status)}>{billingStatusLabel(item.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
