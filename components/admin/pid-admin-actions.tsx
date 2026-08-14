"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PidAdminActions({
  id,
  status,
  currentTargetUrl,
  canManage,
}: {
  id: string;
  status: string;
  currentTargetUrl: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState(currentTargetUrl);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canManage) return null;
  const locked = status === "TOMBSTONE";

  async function send(body: object) {
    setBusy(true);
    setMessage("Mise à jour…");
    const response = await fetch(`/api/admin/pids/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Action enregistrée." : result.error ?? "Action refusée.");
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="admin-institution-form glass card">
      <h2>Actions</h2>
      <label>
        Destination
        <input
          className="input"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          disabled={busy || locked}
          maxLength={2000}
        />
      </label>
      <label>
        Motif (optionnel)
        <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} maxLength={500} />
      </label>
      <div className="admin-form-actions">
        <button
          className="button"
          type="button"
          disabled={busy || locked}
          onClick={() => send({ action: "updateTarget", targetUrl: targetUrl.trim(), reason: reason.trim() || undefined })}
        >
          Mettre à jour la destination
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy || locked || status === "DEPRECATED"}
          onClick={() => send({ action: "deprecate", reason: reason.trim() || undefined })}
        >
          Déprécier
        </button>
        <button
          className="button red"
          type="button"
          disabled={busy || locked}
          onClick={() => {
            if (!window.confirm("Marquer cet identifiant comme tombstone ? Il restera enregistré mais ne sera plus résolu.")) return;
            void send({ action: "tombstone", reason: reason.trim() || undefined });
          }}
        >
          Tombstone
        </button>
      </div>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
