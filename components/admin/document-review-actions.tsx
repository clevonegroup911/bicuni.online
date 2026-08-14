"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DocumentReviewActions({
  documentId,
  canReview,
  canArchive,
}: {
  documentId: string;
  canReview: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: object) {
    setBusy(true);
    setMessage("Mise à jour…");
    const response = await fetch(`/api/admin/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Action enregistrée." : result.error ?? "Action refusée.");
    setBusy(false);
    if (response.ok) router.refresh();
  }

  if (!canReview && !canArchive) return null;

  return (
    <div className="admin-institution-actions">
      {canReview ? (
        <>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => send({ action: "review", review: { decision: "APPROVED" } })}
          >
            Approuver
          </button>
          <label className="admin-reject-field">
            <span>Motif de rejet</span>
            <textarea
              className="input"
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Motif obligatoire (10 caractères minimum)"
            />
          </label>
          <button
            className="button red"
            type="button"
            disabled={busy}
            onClick={() => send({ action: "review", review: { decision: "REJECTED", comment: comment.trim() } })}
          >
            Rejeter
          </button>
        </>
      ) : null}
      {canArchive ? (
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Archiver ce document ? Aucune suppression physique ne sera effectuée.")) return;
            void send({ action: "archive" });
          }}
        >
          Archiver
        </button>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
