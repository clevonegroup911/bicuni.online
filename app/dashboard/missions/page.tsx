import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { listActiveMissions } from "@/lib/oaas/entitlements";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function MissionsPage() {
  const user = await requireUser();
  const missions = await listActiveMissions(user.id);

  return (
    <main className="shell" style={{ paddingBlock: "2rem" }}>
      <Breadcrumb items={[{ label: "Espace", href: "/dashboard" }, { label: "Missions" }]} />
      <header className="page-hero" style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">Mes missions OaaS</span>
        <h1>Suivi des résultats.</h1>
        <p>Progression réelle uniquement — aucune donnée simulée.</p>
        <Link href="/dashboard/missions/new" className="button">
          Décrire le résultat à obtenir
        </Link>
      </header>

      {missions.length === 0 ? (
        <p className="pricing-note">Aucune mission pour le moment.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
          {missions.map((mission) => {
            const done = mission.tasks.filter((t) => t.status === "COMPLETED" || t.status === "SKIPPED").length;
            const total = mission.tasks.length;
            return (
              <li key={mission.id} className="glass card" style={{ padding: "1.25rem" }}>
                <p className="eyebrow">{mission.publicRef}</p>
                <h2 style={{ margin: "0.25rem 0" }}>{mission.title}</h2>
                <p>
                  Statut : <strong>{mission.status}</strong>
                  {mission.pack ? ` · ${mission.pack.title}` : null}
                </p>
                <p>
                  Progression : {total ? `${done}/${total} tâches` : "Plan non généré"}
                  {mission.nextStep ? ` · Prochaine étape : ${mission.nextStep}` : null}
                </p>
                {mission.approvals.length ? (
                  <p role="status">{mission.approvals.length} approbation(s) en attente</p>
                ) : null}
                {mission.blockedReason ? <p className="form-error">{mission.blockedReason}</p> : null}
                <Link href={`/dashboard/missions/${mission.id}`}>Ouvrir</Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
