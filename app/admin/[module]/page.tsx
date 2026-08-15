import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/guards";

const labels = {
  analytics: "Analytique",
  notifications: "Notifications",
  backups: "Sauvegardes",
  monitoring: "Monitoring",
  settings: "Paramètres",
} as const;

export default async function PreparedAdminModule({ params }: { params: Promise<{ module: string }> }) {
  const user = await requireAdmin();
  const moduleName = (await params).module;
  if (!(moduleName in labels)) notFound();
  const label = labels[moduleName as keyof typeof labels];
  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Back Office BICUNI</span>
          <h1>{label}</h1>
          <p>Cette section n’est pas encore branchée sur des opérations métier disponibles.</p>
        </header>
        <section className="glass card admin-preparation">
          <h2>Module en préparation</h2>
          <p>La route est protégée côté serveur. Elle sera activée lorsque Codex aura validé les API, le schéma et les autorisations correspondants. Aucune donnée fictive n’est affichée ici.</p>
        </section>
      </div>
    </AdminShell>
  );
}
