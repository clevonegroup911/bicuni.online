"use client";

import { useState } from "react";

const ACTIONS = [
  { id: "PROPOSE_PAID", label: "Proposer PAID (1er contrôle)" },
  { id: "CONFIRM_PAID", label: "Confirmer PAID (2e contrôle)" },
  { id: "REJECT", label: "Rejeter" },
  { id: "CORRECT", label: "Renvoyer en PENDING" },
] as const;

export function ReconciliationActions({
  publicRef,
  canReview,
  canConfirm,
}: {
  publicRef: string;
  canReview: boolean;
  canConfirm: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action"));
    if (action === "CONFIRM_PAID" && !canConfirm) {
      setError("Permission de confirmation insuffisante.");
      return;
    }
    if (!canReview && action !== "CONFIRM_PAID") {
      setError("Permission de revue insuffisante.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reconciliation/${publicRef}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: String(form.get("reason") ?? ""),
          totp: String(form.get("totp") ?? "") || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; status?: string; receiptNumber?: string };
      if (!response.ok) {
        setError(payload.error ?? "Action refusée.");
        setPending(false);
        return;
      }
      setMessage(payload.receiptNumber ? `PAID — reçu ${payload.receiptNumber}` : `Statut : ${payload.status}`);
      window.location.reload();
    } catch {
      setError("Action administrative indisponible.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      <label>
        Action
        <select className="input" name="action" required>
          {ACTIONS.map((action) => (
            <option key={action.id} value={action.id}>{action.label}</option>
          ))}
        </select>
      </label>
      <label>
        Motif obligatoire
        <textarea className="input textarea" name="reason" required minLength={8} maxLength={500} />
      </label>
      <label>
        Code MFA (obligatoire pour toute action financière)
        <input className="input" name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
      </label>
      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Enregistrement…" : "Journaliser la décision"}
      </button>
    </form>
  );
}
