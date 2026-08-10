import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { InstitutionForm } from "@/components/admin/institution-form";
import { requirePermission } from "@/lib/auth/guards";
import { AdminInstitutionError, AdminInstitutionService, canManageInstitutionGlobally } from "@/lib/admin/institution-service";

export const metadata = { title: "Modifier l’institution" };

export default async function EditInstitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("admin:institutions:manage");
  const { id } = await params;
  let institution;
  try {
    institution = await new AdminInstitutionService().getById(user.id, user.role, id);
  } catch (error) {
    if (error instanceof AdminInstitutionError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">Référentiel institutionnel</span>
            <h1>Modifier · {institution.name}</h1>
            <p>Les changements sont journalisés dans l’audit.</p>
          </div>
          <Link className="button secondary" href={`/admin/institutions/${institution.id}`}>Retour à la fiche</Link>
        </header>
        <InstitutionForm
          mode="edit"
          institutionId={institution.id}
          canSetStatus={canManageInstitutionGlobally(user.role)}
          initial={{
            name: institution.name,
            acronym: institution.acronym,
            slug: institution.slug,
            type: institution.type,
            country: institution.country,
            province: institution.province,
            city: institution.city,
            address: institution.address,
            website: institution.website,
            domain: institution.domain,
            logoUrl: institution.logoUrl,
            status: institution.status,
          }}
        />
      </div>
    </AdminShell>
  );
}
