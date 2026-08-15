"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.get("password") }),
      });
      const result = await response.json() as { message?: string; error?: string };
      setPending(false);
      if (!response.ok) return setError(result.error ?? "Modification impossible.");
      setMessage(result.message ?? "Mot de passe modifié.");
    } catch {
      setPending(false);
      setError("Modification momentanément indisponible. Réessayez.");
    }
  }

  return (
    <AuthShell
      eyebrow={<><ShieldCheck size={15} /> Sécurité</>}
      title="Nouveau mot de passe."
      description="Choisissez un mot de passe unique d’au moins 12 caractères."
      footer={message ? <Link href="/login" className="auth-link">Se connecter</Link> : undefined}
    >
      {message ? <p role="status" className="form-success">{message}</p> :
        token ? (
          <form onSubmit={submit} className="auth-form">
            {error && <p role="alert" className="form-error">{error}</p>}
            <Field id="password" label="Nouveau mot de passe">
              <div className="password-field">
                <input id="password" name="password" className="input" type={show ? "text" : "password"} minLength={12} autoComplete="new-password" required />
                <button type="button" onClick={() => setShow(!show)} className="icon-button" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            <Field id="confirmation" label="Confirmer">
              <input id="confirmation" name="confirmation" className="input" type={show ? "text" : "password"} minLength={12} autoComplete="new-password" required />
            </Field>
            <button className="button" disabled={pending} aria-busy={pending}>{pending ? "Modification…" : "Modifier le mot de passe"}</button>
          </form>
        ) : <p role="alert" className="form-error">Lien de récupération incomplet.</p>}
    </AuthShell>
  );
}
