import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PidAdminActions } from "@/components/admin/pid-admin-actions";
import { requirePermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { PersistentIdentifierError } from "@/lib/pid/errors";
import { PersistentIdentifierService } from "@/lib/pid/service";

export const metadata = { title: "Fiche PID" };

export default async function AdminPidDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePermission("admin:pids:read");
  const { id } = await params;
  const actor = { id: user.id, role: user.role };
  const cursor = (await searchParams).cursor;
  let pid;
  let history;
  try {
    const service = new PersistentIdentifierService();
    pid = await service.getById(id, actor);
    history = await service.history(id, actor, { cursor, limit: 20 });
  } catch (error) {
    if (error instanceof PersistentIdentifierError && error.status === 404) notFound();
    throw error;
  }

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">BICUNI Persistent Identifier</span>
            <h1>{pid.identifier}</h1>
            <p>BICUNI PID interne — distinct d’un DOI officiel. Préfixe, suffixe et identifiant sont immuables après publication.</p>
          </div>
          <Link className="button secondary" href="/admin/pids">Liste</Link>
        </header>
        <section className="admin-dashboard-grid">
          <article className="glass card admin-panel">
            <h2>Identifiant</h2>
            <div className="admin-row"><span><strong>Scheme</strong></span><span>{pid.scheme}</span></div>
            <div className="admin-row"><span><strong>Préfixe</strong></span><span><code>{pid.prefix}</code></span></div>
            <div className="admin-row"><span><strong>Suffixe</strong></span><span><code>{pid.suffix}</code></span></div>
            <div className="admin-row"><span><strong>Identifiant</strong></span><span><code>{pid.identifier}</code></span></div>
            <div className="admin-row"><span><strong>Résolveur</strong></span><span><a href={pid.resolverUrl}>{pid.resolverUrl}</a></span></div>
            <div className="admin-row"><span><strong>Statut</strong></span><span className={`admin-status ${pid.status.toLowerCase()}`}>{pid.status}</span></div>
            <div className="admin-row"><span><strong>Type</strong></span><span>{pid.resourceType}</span></div>
            <div className="admin-row"><span><strong>Ressource</strong></span><span>{pid.resourceId}</span></div>
          </article>
          <article className="glass card admin-panel">
            <h2>Destination</h2>
            <div className="admin-row"><span><strong>URL actuelle</strong></span><span>{pid.targetUrl}</span></div>
            <div className="admin-row"><span><strong>Créé le</strong></span><span>{pid.createdAt.toLocaleString("fr-FR")}</span></div>
            <div className="admin-row"><span><strong>Créé par</strong></span><span>{pid.createdBy?.name ?? "Système"}</span></div>
          </article>
        </section>
        <PidAdminActions
          id={pid.id}
          status={pid.status}
          currentTargetUrl={pid.targetUrl}
          canManage={can(user.role, "admin:pids:manage")}
        />
        <section className="glass card admin-panel admin-panel-wide" style={{ marginTop: 16 }}>
          <h2>Historique des destinations</h2>
          {history.items.length === 0 ? (
            <p>Aucune modification de destination.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Précédente</th>
                  <th>Nouvelle</th>
                  <th>Auteur</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.changedAt.toLocaleString("fr-FR")}</td>
                    <td>{entry.previousTargetUrl}</td>
                    <td>{entry.newTargetUrl}</td>
                    <td>{entry.changedBy?.name ?? "Système"}</td>
                    <td>{entry.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {history.nextCursor ? (
            <p>
              <Link href={`/admin/pids/${pid.id}?cursor=${encodeURIComponent(history.nextCursor)}`}>
                Entrées suivantes
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
