import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { InstitutionActions } from "@/components/admin/institution-actions";
import { can } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/guards";
import { AdminInstitutionError, AdminInstitutionService, canManageInstitutionGlobally } from "@/lib/admin/institution-service";

export const metadata = { title: "Fiche institution" };

export default async function InstitutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("admin:institutions:read");
  const { id } = await params;
  let institution;
  try {
    institution = await new AdminInstitutionService().getById(user.id, user.role, id);
  } catch (error) {
    if (error instanceof AdminInstitutionError && error.status === 404) notFound();
    if (error instanceof AdminInstitutionError && error.status === 403) notFound();
    throw error;
  }

  const canManage = can(user.role, "admin:institutions:manage");
  const canChangeStatus = canManageInstitutionGlobally(user.role);

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">Fiche institution</span>
            <h1>{institution.name}</h1>
            <p>
              {institution.acronym ? `${institution.acronym} · ` : ""}
              {institution.slug} · {institution.type}
            </p>
          </div>
          <div className="admin-institution-header-actions">
            <Link className="button secondary" href="/admin/institutions">Liste</Link>
            {canManage ? (
              <Link className="button" href={`/admin/institutions/${institution.id}/edit`}>Modifier</Link>
            ) : null}
            <InstitutionActions id={institution.id} status={institution.status} canChangeStatus={canChangeStatus} />
          </div>
        </header>

        <section className="admin-dashboard-grid">
          <article className="glass card admin-panel">
            <h2>Informations principales</h2>
            <div className="admin-row"><span><strong>Statut</strong></span><span className={`admin-status ${institution.status.toLowerCase()}`}>{institution.status}</span></div>
            <div className="admin-row"><span><strong>Pays</strong><small>{institution.province ?? "—"} / {institution.city ?? "—"}</small></span><span>{institution.country}</span></div>
            <div className="admin-row"><span><strong>Adresse</strong></span><span>{institution.address ?? "—"}</span></div>
            <div className="admin-row"><span><strong>Site web</strong></span><span>{institution.website ?? "—"}</span></div>
            <div className="admin-row"><span><strong>Domaine</strong></span><span>{institution.domain ?? "—"}</span></div>
            <div className="admin-row"><span><strong>Créée</strong></span><time>{institution.createdAt.toLocaleString("fr-FR")}</time></div>
            <div className="admin-row"><span><strong>Mise à jour</strong></span><time>{institution.updatedAt.toLocaleString("fr-FR")}</time></div>
          </article>

          <article className="glass card admin-panel">
            <h2>Indicateurs</h2>
            <div className="admin-row"><span><strong>Responsables</strong></span><strong>{institution._count.admins}</strong></div>
            <div className="admin-row"><span><strong>Utilisateurs liés</strong></span><strong>{institution._count.profiles}</strong></div>
            <div className="admin-row"><span><strong>Documents</strong></span><strong>{institution._count.documents}</strong></div>
            <div className="admin-row"><span><strong>Facultés</strong></span><strong>{institution._count.faculties}</strong></div>
          </article>

          <article className="glass card admin-panel">
            <h2>Responsables</h2>
            {institution.admins.length === 0 ? <p><small>Aucun responsable assigné.</small></p> : null}
            {institution.admins.map((admin) => (
              <div className="admin-row" key={admin.id}>
                <span>
                  <strong>{admin.name ?? admin.email}</strong>
                  <small>{admin.role} · {admin.status}</small>
                </span>
                <small>{admin.email}</small>
              </div>
            ))}
          </article>

          <article className="glass card admin-panel">
            <h2>Utilisateurs liés</h2>
            {institution.profiles.length === 0 ? <p><small>Aucun profil affilié.</small></p> : null}
            {institution.profiles.map((profile) => (
              <div className="admin-row" key={profile.id}>
                <span>
                  <strong>{profile.user.name ?? profile.user.email}</strong>
                  <small>{profile.user.role} · {profile.title ?? "Sans titre"}</small>
                </span>
                <span className={`admin-status ${profile.user.status.toLowerCase()}`}>{profile.user.status}</span>
              </div>
            ))}
          </article>

          <article className="glass card admin-panel admin-panel-wide">
            <h2>Documents liés</h2>
            {institution.documents.length === 0 ? <p><small>Aucun document rattaché.</small></p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Titre</th><th>Type</th><th>Statut</th><th>Mise à jour</th></tr>
                  </thead>
                  <tbody>
                    {institution.documents.map((document) => (
                      <tr key={document.id}>
                        <td><strong>{document.title}</strong><small>{document.slug}</small></td>
                        <td>{document.type}</td>
                        <td><span className={`admin-status ${document.status.toLowerCase()}`}>{document.status}</span></td>
                        <td>{document.updatedAt.toLocaleDateString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="glass card admin-panel admin-panel-wide">
            <h2>Activité récente / audit</h2>
            {!institution.auditLogsVisible ? (
              <p><small>Les journaux d’audit détaillés nécessitent la permission admin:audit:read.</small></p>
            ) : institution.auditLogs.length === 0 ? (
              <p><small>Aucune activité auditée pour cette institution.</small></p>
            ) : null}
            {institution.auditLogsVisible
              ? institution.auditLogs.map((log) => (
                <div className="admin-row" key={log.id}>
                  <span>
                    <strong>{log.action}</strong>
                    <small>{log.actor?.name ?? log.actor?.email ?? "Système"} · {log.actor?.role ?? "n/a"}</small>
                  </span>
                  <time>{log.createdAt.toLocaleString("fr-FR")}</time>
                </div>
              ))
              : null}
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
