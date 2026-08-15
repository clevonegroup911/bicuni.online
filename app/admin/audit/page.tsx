import { Activity } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export default async function AuditPage() {
  const user = await requirePermission("admin:audit:read");
  const logs = await db.auditLog.findMany({
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Traçabilité</span>
          <h1>Journaux d’audit</h1>
          <p>Les secrets, mots de passe et tokens ne sont jamais enregistrés. Les 100 événements les plus récents sont affichés.</p>
        </header>
        {logs.length ? (
          <div className="admin-table-wrap glass">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Responsable</th>
                  <th>Action</th>
                  <th>Ressource</th>
                  <th>Identifiant</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.createdAt.toLocaleString("fr-FR")}</td>
                    <td>{log.actor?.name ?? log.actor?.email ?? "Système"}</td>
                    <td>{log.action}</td>
                    <td>{log.entityType}</td>
                    <td><code>{log.entityId ?? "—"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Activity} title="Aucun journal" description="Les actions administratives authentifiées apparaîtront ici." />
        )}
      </div>
    </AdminShell>
  );
}
