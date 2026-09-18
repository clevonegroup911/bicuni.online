"use client";

import { useState } from "react";

type RateRow = {
  id: string;
  rateUnits: number;
  source: string;
  effectiveAt: string;
  expiresAt: string | null;
  status: string;
  enteredById: string;
  approvedById: string | null;
};

export function FxRateAdmin({ initialRates }: { initialRates: RateRow[] }) {
  const [rates, setRates] = useState<RateRow[]>(initialRates);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/fx", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { rates?: RateRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Lecture des taux impossible.");
      return;
    }
    setRates(payload.rates ?? []);
  }

  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/fx", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rateUnits: Number(form.get("rateUnits")),
        source: String(form.get("source") ?? ""),
        effectiveAt: new Date(String(form.get("effectiveAt") ?? "")).toISOString(),
        reason: String(form.get("reason") ?? ""),
        totp: String(form.get("totp") ?? "") || undefined,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Proposition refusée.");
      return;
    }
    setMessage("Taux proposé. Un second administrateur doit l’approuver. Les factures déjà émises ne changent pas.");
    await refresh();
  }

  async function decide(id: string, action: "APPROVE" | "REJECT", reason: string, totp: string) {
    setError("");
    const response = await fetch(`/api/admin/fx/${id}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, totp: totp || undefined }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Décision refusée.");
      return;
    }
    setMessage(action === "APPROVE" ? "Taux actif. Les nouvelles commandes CDF l’utilisent." : "Taux rejeté.");
    await refresh();
  }

  return (
    <div className="admin-panel">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      <form className="auth-form" onSubmit={(event) => void propose(event)}>
        <label>
          Taux entier (CDF pour 1 USD)
          <input className="input" name="rateUnits" type="number" min={1} max={50000} required />
        </label>
        <label>
          Source
          <input className="input" name="source" required minLength={4} maxLength={120} placeholder="Relevé RAWBANK TEST" />
        </label>
        <label>
          Date d’effet
          <input className="input" name="effectiveAt" type="datetime-local" required />
        </label>
        <label>
          Motif
          <textarea className="input textarea" name="reason" required minLength={8} maxLength={500} />
        </label>
        <label>
          Code MFA
          <input className="input" name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        </label>
        <button className="button" type="submit">Proposer un taux</button>
      </form>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Taux</th>
            <th>Source</th>
            <th>Effet</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id}>
              <td>1 USD = {rate.rateUnits} CDF</td>
              <td>{rate.source}</td>
              <td>{new Date(rate.effectiveAt).toLocaleString("fr-FR")}</td>
              <td>{rate.status}</td>
              <td>
                {rate.status === "PENDING_APPROVAL" ? (
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void decide(rate.id, "APPROVE", String(form.get("reason") ?? ""), String(form.get("totp") ?? ""));
                  }}>
                    <input className="input" name="reason" placeholder="Motif d’approbation" required minLength={8} />
                    <input className="input" name="totp" placeholder="MFA" maxLength={6} />
                    <button className="button" type="submit">Approuver (2e admin)</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
