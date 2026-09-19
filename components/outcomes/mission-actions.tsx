"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Approval = { id: string; title: string; status: string };

export function MissionActions({
  missionId,
  status,
  approvals,
}: {
  missionId: string;
  status: string;
  approvals: Approval[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: string, body?: unknown) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch(`/api/outcomes/${missionId}?action=${action}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Échec");
        return;
      }
      setMessage(action === "run" ? `Statut : ${data.status ?? "ok"}` : "OK");
      router.refresh();
    });
  }

  return (
    <div className="glass card" style={{ padding: "1.25rem" }}>
      <h2>Actions</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {status === "PLANNED" || status === "READY" ? (
          <button type="button" className="button" disabled={pending} onClick={() => run("plan")}>
            Générer le plan
          </button>
        ) : null}
        {status === "READY" || status === "EXECUTING" || status === "AWAITING_HUMAN_REVIEW" ? (
          <>
            <button type="button" className="button secondary" disabled={pending} onClick={() => run("step")}>
              Étape suivante
            </button>
            <button type="button" className="button" disabled={pending} onClick={() => run("run")}>
              Exécuter jusqu’à pause / livraison
            </button>
          </>
        ) : null}
        {status === "AWAITING_PAYMENT" ? (
          <>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() =>
                run("pay-test", { idempotencyKey: `oaas-test:${missionId}:${Date.now()}` })
              }
            >
              Confirmer paiement TEST
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() =>
                run("checkout", { channel: "MPESA", idempotencyKey: `oaas:${missionId}:${Date.now()}` })
              }
            >
              Créer paiement CLEVONE (manuel)
            </button>
            <p className="pricing-note">
              Stripe OaaS = ADAPTER_NOT_CONFIGURED. Le paiement TEST débloque la mission une seule fois, sans fausse confirmation bancaire.
            </p>
          </>
        ) : null}
        {(status === "DRAFT" || status === "QUALIFICATION_REQUIRED") && (
          <button type="button" className="button" disabled={pending} onClick={() => run("qualify")}>
            Qualifier
          </button>
        )}
        {status === "QUALIFIED" || status === "QUOTED" ? (
          <button type="button" className="button" disabled={pending} onClick={() => run("quote", {})}>
            Établir devis &amp; contrat
          </button>
        ) : null}
        {status === "AWAITING_APPROVAL" ? (
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => run("contract", { decision: "accept" })}
          >
            Accepter le contrat
          </button>
        ) : null}
        {status === "DELIVERED" ? (
          <>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => run("accept", { decision: "ACCEPTED" })}
            >
              Accepter la livraison
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() => run("accept", { decision: "REVISION_REQUESTED", comment: "Correction demandée" })}
            >
              Demander une correction
            </button>
          </>
        ) : null}
      </div>

      {approvals
        .filter((a) => a.status === "PENDING")
        .map((approval) => (
          <div key={approval.id} style={{ marginTop: "1rem" }}>
            <p>{approval.title}</p>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => run("approval", { approvalId: approval.id, decision: "APPROVED" })}
            >
              Approuver
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() =>
                run("approval", { approvalId: approval.id, decision: "REJECTED", reason: "Refusé par le client" })
              }
            >
              Refuser
            </button>
          </div>
        ))}

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
