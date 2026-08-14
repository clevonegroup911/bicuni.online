import Link from "next/link";
import { Archive, CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/lib/auth/guards";
import { AdminDocumentService } from "@/lib/admin/document-admin-service";
import { resolveAdminDocumentQuery } from "@/lib/admin/validators";

export const metadata = { title: "Documents" };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente",
  APPROVED: "Approuvé",
  PUBLISHED: "Publié",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
};

function displayName(value: string | null | undefined) {
  return value?.trim() ? value : "Non renseigné";
}

function queryString(filters: Record<string, string | number | undefined>, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", String(filters.q));
  if (filters.status) params.set("status", String(filters.status));
  if (filters.type) params.set("type", String(filters.type));
  if (filters.institutionId) params.set("institutionId", String(filters.institutionId));
  if (filters.from) params.set("from", String(filters.from));
  if (filters.to) params.set("to", String(filters.to));
  if (filters.limit) params.set("limit", String(filters.limit));
  params.set("page", String(page));
  return params.toString();
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    limit?: string;
    status?: string;
    type?: string;
    institutionId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requirePermission("admin:documents:review");
  const raw = await searchParams;
  const { data: filters } = resolveAdminDocumentQuery(raw);
  const service = new AdminDocumentService();
  const [result, statistics, institutions] = await Promise.all([
    service.list({ actorId: user.id, actorRole: user.role, ...filters }),
    service.statistics(user.id, user.role),
    service.listFilterInstitutions(user.id, user.role),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const page = filters.page;
  const stats = [
    [Clock3, statistics.pending, "En attente de validation"],
    [CheckCircle2, statistics.approved, "Approuvés"],
    [FileText, statistics.published, "Publiés"],
    [XCircle, statistics.rejected, "Rejetés"],
    [Archive, statistics.archived, "Archivés"],
  ] as const;

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Centre documentaire</span>
          <h1>Documents</h1>
          <p>
            {result.total} document{result.total > 1 ? "s" : ""} dans ce périmètre, calculé
            {result.total > 1 ? "s" : ""} depuis PostgreSQL.
          </p>
        </header>

        <section className="admin-stats admin-stats-documents">
          {stats.map(([Icon, value, label]) => (
            <article className="glass card" key={label}>
              <Icon size={18} />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        <form className="admin-filters admin-filters-documents">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Titre ou auteur" />
          <select className="input" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Tous les statuts</option>
            {Object.values(DocumentStatus).filter((value) => value !== "DELETED").map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value] ?? value}</option>
            ))}
          </select>
          <select className="input" name="type" defaultValue={filters.type ?? ""}>
            <option value="">Tous les types</option>
            {Object.values(DocumentType).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="input" name="institutionId" defaultValue={filters.institutionId ?? ""}>
            <option value="">Toutes les institutions</option>
            {institutions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.acronym ? `${item.acronym} — ${item.name}` : item.name}
              </option>
            ))}
          </select>
          <input className="input" type="date" name="from" defaultValue={filters.from ?? ""} aria-label="Mis à jour depuis" />
          <button className="button">Filtrer</button>
        </form>

        <div className="admin-table-wrap glass">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Auteur</th>
                <th>Institution</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Version</th>
                <th>Mise à jour</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {result.documents.length === 0 ? (
                <tr>
                  <td colSpan={8}><small>Aucun document dans ce périmètre.</small></td>
                </tr>
              ) : (
                result.documents.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/admin/documents/${item.id}`}>
                        <strong>{item.title}</strong>
                      </Link>
                    </td>
                    <td>{displayName(item.author.name)}</td>
                    <td>{displayName(item.university?.name)}</td>
                    <td>{item.type}</td>
                    <td>
                      <span className={`admin-status ${item.status.toLowerCase()}`}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>v{item.currentVersion}</td>
                    <td>
                      <time>{item.updatedAt.toLocaleString("fr-FR")}</time>
                    </td>
                    <td>
                      <Link className="button secondary" href={`/admin/documents/${item.id}`}>Examiner</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <nav className="admin-pagination" aria-label="Pagination documents">
            {page > 1 ? (
              <Link className="button secondary" href={`/admin/documents?${queryString(filters, page - 1)}`}>
                Précédent
              </Link>
            ) : null}
            <span>Page {page} / {totalPages}</span>
            {page < totalPages ? (
              <Link className="button secondary" href={`/admin/documents?${queryString(filters, page + 1)}`}>
                Suivant
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </AdminShell>
  );
}
