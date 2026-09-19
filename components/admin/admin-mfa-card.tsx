"use client";

import { useEffect, useState } from "react";

export function AdminMfaCard() {
  const [otpauth, setOtpauth] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/mfa", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { enabled?: boolean }) => setEnabled(Boolean(payload.enabled)))
      .catch(() => undefined);
  }, []);

  async function enroll() {
    setError("");
    const response = await fetch("/api/admin/mfa", { method: "POST", credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { otpauth?: string; error?: string };
    if (!response.ok || !payload.otpauth) {
      setError(payload.error ?? "Enrôlement MFA impossible.");
      return;
    }
    setOtpauth(payload.otpauth);
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const totp = String(new FormData(event.currentTarget).get("totp") ?? "");
    const response = await fetch("/api/admin/mfa?confirm=1", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totp }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; enabled?: boolean; recoveryCodes?: string[] };
    if (!response.ok) {
      setError(payload.error ?? "Code invalide.");
      return;
    }
    setEnabled(true);
    setMessage(payload.recoveryCodes?.length
      ? `MFA activé. Conservez ces codes de récupération hors ligne : ${payload.recoveryCodes.join(" ")}`
      : "MFA administrateur activé.");
    setOtpauth("");
  }

  return (
    <section className="glass card admin-panel">
      <h2>MFA TOTP</h2>
      <p className="muted">Obligatoire en production pour la connexion administrative et toute action financière (revue, PAID, remboursement, taux USD/CDF). Le secret n’est jamais réaffiché en clair.</p>
      {enabled ? <p className="form-success">MFA actif sur ce compte.</p> : (
        <>
          <button type="button" className="button" onClick={() => void enroll()}>Générer un secret</button>
          {otpauth ? <p className="admin-checksum">{otpauth}</p> : null}
          <form className="auth-form" onSubmit={(event) => void confirm(event)}>
            <label>
              Code à 6 chiffres
              <input className="input" name="totp" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            </label>
            <button className="button" type="submit">Activer</button>
          </form>
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
    </section>
  );
}
