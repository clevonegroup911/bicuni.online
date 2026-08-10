import Link from "next/link";
import { InstitutionStatus, InstitutionType } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { InstitutionActions } from "@/components/admin/institution-actions";
import { can } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/guards";
import { AdminInstitutionService, canManageInstitutionGlobally } from "@/lib/admin/institution-service";
import { resolveAdminInstitutionQuery } from "@/lib/admin/validators";

export const metadata = { title: "Institutions" };

export default async function AdminInstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; type?: string; country?: string }>;
}) {
  const user = await requirePermission("admin:institutions:read");
  const raw = await searchParams;
  const { data: filters } = resolveAdminInstitutionQuery(raw);
  const result = await new AdminInstitutionService().list({
    actorId: user.id,
    actorRole: user.role,
    ...filters,
  });
  const canManage = can(user.role, "admin:institutions:manage");
  const canCreate = canManageInstitutionGlobally(user.role);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const page = filters.page;

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">Référentiel institutionnel</span>
            <h1>Institutions</h1>
            <p>
              {result.total} institution{result.total > 1 ? "s" : ""} correspondant aux filtres.
            </p>
          </div>
          {canCreate ? (
            <Link className="button" href="/admin/institutions/new">
              Nouvelle institution
            </Link>
          ) : null}
        </header>

        <form className="admin-filters admin-filters-institutions">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Nom, acronyme, slug ou ville" />
          <select className="input" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Tous les statuts</option>
            {Object.values(InstitutionStatus).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="input" name="type" defaultValue={filters.type ?? ""}>
            <option value="">Tous les types</option>
            {Object.values(InstitutionType).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <input className="input" name="country" defaultValue={filters.country ?? ""} placeholder="Pays" />
          <button className="button">Filtrer</button>
        </form>

        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Type</th>
                <th>Pays</th>
                <th>Utilisateurs</th>
                <th>Documents</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.institutions.length === 0 ? (
                <tr>
                  <td colSpan={7}><small>Aucune institution dans ce périmètre.</small></td>
                </tr>
              ) : (
                result.institutions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/admin/institutions/${item.id}`}>
                        <strong>{item.name}</strong>
                      </Link>
                      <small>{item.acronym ? `${item.acronym} · ` : ""}{item.slug}{item.city ? ` · ${item.city}` : ""}</small>
                    </td>
                    <td>{item.type}</td>
                    <td>{item.country}</td>
                    <td>{item._count.profiles}</td>
                    <td>{item._count.documents}</td>
                    <td>
                      <span className={`admin-status ${item.status.toLowerCase()}`}>{item.status}</span>
                    </td>
                    <td>
                      <div className="admin-institution-row-actions">
                        <Link className="button secondary" href={`/admin/institutions/${item.id}`}>Voir</Link>
                        {canManage ? (
                          <Link className="button secondary" href={`/admin/institutions/${item.id}/edit`}>Modifier</Link>
                        ) : null}
                        <InstitutionActions
                          id={item.id}
                          status={item.status}
                          canChangeStatus={canCreate}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <nav className="admin-pagination" aria-label="Pagination institutions">
            {page > 1 ? (
              <Link
                className="button secondary"
                href={`/admin/institutions?${new URLSearchParams({
                  ...(filters.q ? { q: filters.q } : {}),
                  ...(filters.status ? { status: filters.status } : {}),
                  ...(filters.type ? { type: filters.type } : {}),
                  ...(filters.country ? { country: filters.country } : {}),
                  page: String(page - 1),
                }).toString()}`}
              >
                Précédent
              </Link>
            ) : null}
            <span>
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                className="button secondary"
                href={`/admin/institutions?${new URLSearchParams({
                  ...(filters.q ? { q: filters.q } : {}),
                  ...(filters.status ? { status: filters.status } : {}),
                  ...(filters.type ? { type: filters.type } : {}),
                  ...(filters.country ? { country: filters.country } : {}),
                  page: String(page + 1),
                }).toString()}`}
              >
                Suivant
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </AdminShell>
  );
}
