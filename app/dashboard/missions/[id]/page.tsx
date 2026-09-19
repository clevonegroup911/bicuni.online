import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { OutcomeServiceError, getMissionForOwner } from "@/lib/oaas/mission-service";
import { formatAgentAvailabilityLine } from "@/lib/oaas/agents";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { MissionActions } from "@/components/outcomes/mission-actions";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  let mission;
  try {
    mission = await getMissionForOwner(db, id, user.id);
  } catch (error) {
    if (error instanceof OutcomeServiceError && error.status === 404) notFound();
    throw error;
  }

  const done = mission.tasks.filter((t) => t.status === "COMPLETED" || t.status === "SKIPPED").length;

  return (
    <main className="shell" style={{ paddingBlock: "2rem" }}>
      <Breadcrumb
        items={[
          { label: "Espace", href: "/dashboard" },
          { label: "Missions", href: "/dashboard/missions" },
          { label: mission.publicRef },
        ]}
      />
      <header className="page-hero" style={{ marginBottom: "1.5rem" }}>
        <span className="eyebrow">{mission.publicRef}</span>
        <h1>{mission.title}</h1>
        <p>
          Statut <strong>{mission.status}</strong>
          {mission.nextStep ? ` · ${mission.nextStep}` : null}
        </p>
        <p className="pricing-note">{mission.integrityDeclaration}</p>
      </header>

      <MissionActions missionId={mission.id} status={mission.status} approvals={mission.approvals} />

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Progression</h2>
        <p>
          {mission.tasks.length ? `${done}/${mission.tasks.length} tâches` : "Aucun plan"}
          {mission.estimatedCostCents != null ? ` · Estimé ${mission.estimatedCostCents} cents ${mission.currency}` : null}
          {mission.actualCostCents ? ` · Consommé ${mission.actualCostCents}` : null}
        </p>
        <ul>
          {mission.tasks.map((task) => (
            <li key={task.id}>
              {task.title} — {task.status}
              {task.agentKey ? ` (${task.agentKey})` : null}
            </li>
          ))}
        </ul>
      </section>

      {mission.contract ? (
        <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
          <h2>Contrat de résultat v{mission.contract.version}</h2>
          <p>Statut : {mission.contract.status}</p>
          <p>Objectif : {mission.contract.objective}</p>
          <p>
            Prix {mission.contract.priceCents} · Acompte {mission.contract.depositCents} · Solde{" "}
            {mission.contract.balanceCents} {mission.contract.currency}
          </p>
          <p>Révisions incluses : {mission.contract.revisionsIncluded}</p>
        </section>
      ) : null}

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Livrables</h2>
        {mission.deliverables.length === 0 ? (
          <p>Aucun livrable pour l’instant.</p>
        ) : (
          <ul>
            {mission.deliverables.map((d) => (
              <li key={d.id}>
                {d.title} ({d.format}) — {d.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Preuves</h2>
        {mission.evidences.length === 0 ? (
          <p>Aucune preuve enregistrée.</p>
        ) : (
          <ul>
            {mission.evidences.map((e) => (
              <li key={e.id}>
                [{e.kind}] {e.title}
                {e.checksum ? ` · checksum ${e.checksum.slice(0, 12)}…` : ""}
                {e.invented ? " ⚠ inventée" : ""}
                {e.summary ? ` — ${e.summary}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Contrôles qualité</h2>
        {mission.qualityChecks.length === 0 ? (
          <p>Aucun contrôle exécuté pour l’instant.</p>
        ) : (
          <ul>
            {mission.qualityChecks.map((q) => (
              <li key={q.id}>
                {q.title} — <strong>{q.verdict}</strong>
                {q.checkedAt ? ` · ${q.checkedAt.toISOString()}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Approbations</h2>
        {mission.approvals.length === 0 ? (
          <p>Aucune approbation.</p>
        ) : (
          <ul>
            {mission.approvals.map((a) => (
              <li key={a.id}>
                {a.title} — {a.status}
                {a.reason ? ` · ${a.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Agents assignés</h2>
        {mission.agentAssignments.length === 0 ? (
          <p>Aucun agent assigné (plan non généré).</p>
        ) : (
          <ul>
            {mission.agentAssignments.map((a) => (
              <li key={a.id}>
                {a.agent.name} ({a.agent.key}) — {formatAgentAvailabilityLine(a.agent.key, a.agent.available)} · v{a.agent.version}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
        <h2>Factures & paiements</h2>
        <ul>
          {mission.invoices.map((inv) => (
            <li key={inv.id}>
              Facture {inv.number ?? inv.id} — {inv.status} — {inv.amountPaidCents}/{inv.amountDueCents} {inv.currency}
            </li>
          ))}
          {mission.paymentIntents.map((pi) => (
            <li key={pi.id}>
              <Link href={`/pay/${pi.publicRef}`}>{pi.publicRef}</Link> — {pi.status} — {pi.amountCents} {pi.currency}
              {pi.publicRef.startsWith("TEST-") ? " · TEST" : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
