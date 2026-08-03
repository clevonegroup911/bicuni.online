"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") }),
    });
    const result = await response.json() as { message?: string; error?: string };
    setPending(false);
    if (!response.ok) return setError(result.error ?? "Modification impossible.");
    setMessage(result.message ?? "Mot de passe modifié.");
  }

  return <AuthShell eyebrow={<><ShieldCheck size={15}/> Sécurité</>} title="Nouveau mot de passe." description="Choisissez un mot de passe unique d’au moins 12 caractères."
    footer={message ? <Link href="/login" className="auth-link">Se connecter</Link> : undefined}>
    {message ? <p role="status" className="form-success">{message}</p> :
      token ? <form onSubmit={submit} className="auth-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>Nouveau mot de passe<input name="password" className="input" type="password" minLength={12} autoComplete="new-password" required/></label>
        <label>Confirmer<input name="confirmation" className="input" type="password" minLength={12} autoComplete="new-password" required/></label>
        <button className="button" disabled={pending}>{pending ? "Modification…" : "Modifier le mot de passe"}</button>
      </form> : <p role="alert" className="form-error">Lien de récupération incomplet.</p>}
  </AuthShell>;
}
