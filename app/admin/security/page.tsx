import { AdminShell } from "@/components/admin/admin-shell";
import { AdminMfaCard } from "@/components/admin/admin-mfa-card";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "Sécurité administrateur" };

export default async function AdminSecurityPage() {
  const user = await requirePermission("admin:payments:confirm", { allowMfaEnrollment: true });
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Sécurité</span>
          <h1>MFA des paiements</h1>
          <p>Le second contrôle PAID exige un TOTP lorsque le MFA est actif, et toujours en production.</p>
        </header>
        <AdminMfaCard />
      </div>
    </AdminShell>
  );
}
