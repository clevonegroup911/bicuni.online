import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { InstitutionForm } from "@/components/admin/institution-form";
import { requirePermission } from "@/lib/auth/guards";
import { canManageInstitutionGlobally } from "@/lib/admin/institution-service";

export const metadata = { title: "Nouvelle institution" };

export default async function NewInstitutionPage() {
  const user = await requirePermission("admin:institutions:manage");
  if (!canManageInstitutionGlobally(user.role)) redirect("/admin/institutions");

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">Référentiel institutionnel</span>
            <h1>Nouvelle institution</h1>
            <p>Création contrôlée côté serveur avec journal d’audit.</p>
          </div>
          <Link className="button secondary" href="/admin/institutions">Retour</Link>
        </header>
        <InstitutionForm mode="create" canSetStatus />
      </div>
    </AdminShell>
  );
}
