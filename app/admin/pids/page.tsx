import Link from "next/link";
import { PersistentIdentifierStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { CreatePidForm } from "@/components/admin/create-pid-form";
import { requirePermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { adminPidQuerySchema } from "@/lib/pid/validators";

export const metadata = { title: "Identifiants PID" };

export default async function AdminPidsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const user = await requirePermission("admin:pids:read");
  const raw = await searchParams;
  const parsed = adminPidQuerySchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : adminPidQuerySchema.parse({});
  const result = await new PersistentIdentifierService().list({
    ...filters,
    actorId: user.id,
    actorRole: user.role,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">BICUNI Persistent Identifier</span>
          <h1>BICUNI PID</h1>
            <p>
            {result.total} identifiant{result.total > 1 ? "s" : ""} BICUNI PID enregistré{result.total > 1 ? "s" : ""}.
            Ce n’est pas un DOI officiel. L’identifiant lui-même n’est jamais modifié après publication.
          </p>
        </header>
        <form className="admin-filters">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Identifiant, ressource ou destination" />
          <select className="input" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Tous les statuts</option>
            {Object.values(PersistentIdentifierStatus).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button className="button">Filtrer</button>
        </form>
        {can(user.role, "admin:pids:manage") ? <CreatePidForm /> : null}
        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Création</th>
              </tr>
            </thead>
            <tbody>
              {result.items.length === 0 ? (
                <tr><td colSpan={4}>Aucun identifiant pérenne.</td></tr>
              ) : result.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/admin/pids/${item.id}`}><strong>{item.identifier}</strong></Link>
                    <small>{item.resolverUrl}</small>
                  </td>
                  <td>{item.resourceType}</td>
                  <td><span className={`admin-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                  <td>{item.createdAt.toLocaleString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="admin-pagination">
            {filters.page > 1 ? <Link href={`/admin/pids?q=${encodeURIComponent(filters.q)}&status=${filters.status ?? ""}&page=${filters.page - 1}`}>Précédent</Link> : null}
            <span>Page {result.page} / {totalPages}</span>
            {filters.page < totalPages ? <Link href={`/admin/pids?q=${encodeURIComponent(filters.q)}&status=${filters.status ?? ""}&page=${filters.page + 1}`}>Suivant</Link> : null}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
