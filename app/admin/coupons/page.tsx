import { AdminShell } from "@/components/admin/admin-shell";
import { CouponBoard } from "@/components/admin/coupon-board";
import { requirePermission } from "@/lib/auth/guards";
import { COUPON_API_CONTRACT } from "@/lib/billing/contracts";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const user = await requirePermission("admin:audit:read");
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Coupons</h1>
          <p>Interface préparée. Le module restera inactif tant que Codex n’aura pas livré le modèle et les API.</p>
        </header>
        <CouponBoard configured={COUPON_API_CONTRACT.configured} canManage={false} />
      </div>
    </AdminShell>
  );
}
