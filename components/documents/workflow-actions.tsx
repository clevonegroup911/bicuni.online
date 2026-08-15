"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";

const labels = { submit: "Soumettre", approve: "Approuver", reject: "Rejeter", archive: "Archiver" } as const;

export function WorkflowActions({
  documentId,
  actions,
}: {
  documentId: string;
  actions: ("submit" | "approve" | "reject" | "archive")[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function act(action: string, reviewComment?: string) {
    if (action === "reject") {
      setRejectOpen(true);
      return;
    }
    if (action === "archive" && !window.confirm("Archiver ce document ? Cette action est sensible.")) return;
    if (action === "submit" && !window.confirm("Soumettre ce brouillon à la révision institutionnelle ?")) return;
    await send(action, reviewComment);
  }

  async function send(action: string, reviewComment?: string) {
    setPending(action);
    setError("");
    let payload: object = { action };
    if (action === "approve") payload = { action: "review", review: { decision: "APPROVED" } };
    if (action === "reject") payload = { action: "review", review: { decision: "REJECTED", comment: reviewComment } };
    try {
      const response = await fetch(`/api/documents/${documentId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Action refusée.");
        setPending(null);
        return;
      }
      setRejectOpen(false);
      setComment("");
      router.refresh();
    } catch {
      setError("Action momentanément indisponible.");
    }
    setPending(null);
  }

  if (!actions.length) return null;

  return (
    <div className="action-cluster">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="workflow-actions">
      {actions.map((action) => (
        <button
          className={`button ${action === "reject" || action === "archive" ? "red" : "secondary"}`}
          key={action}
          type="button"
          disabled={Boolean(pending)}
          aria-busy={pending === action}
          onClick={() => act(action)}
        >
          {pending === action ? "Traitement…" : labels[action]}
        </button>
      ))}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Motif du rejet">
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim()) return setError("Le motif de rejet est obligatoire.");
            void send("reject", comment.trim());
          }}
        >
          <label htmlFor="reject-comment">Motif détaillé
            <textarea id="reject-comment" className="input textarea" value={comment} onChange={(event) => setComment(event.target.value)} required minLength={8} />
          </label>
          <div className="admin-form-actions">
            <button className="button red" disabled={pending === "reject"}>{pending === "reject" ? "Envoi…" : "Confirmer le rejet"}</button>
            <button type="button" className="button secondary" onClick={() => setRejectOpen(false)}>Annuler</button>
          </div>
        </form>
      </Modal>
      </div>
    </div>
  );
}
