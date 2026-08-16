"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const email = new FormData(event.currentTarget).get("email");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { message?: string; error?: string };
      setPending(false);
      if (!response.ok) {
        setError(result.error ?? "Envoi momentanément indisponible.");
        return;
      }
      setMessage(result.message ?? "Si un compte existe, un lien a été envoyé.");
    } catch {
      setPending(false);
      setError("Envoi momentanément indisponible. Réessayez.");
    }
  }

  return (
    <AuthShell
      eyebrow={<><KeyRound size={15} /> Récupération</>}
      title="Retrouver votre accès."
      description="Nous vous enverrons un lien sécurisé valable une heure, sans indiquer si l’adresse est enregistrée."
      footer={<Link href="/login" className="auth-link">Retour à la connexion</Link>}
    >
      {message ? <p role="status" className="form-success">{message}</p> : (
        <form method="post" action="/forgot-password" onSubmit={submit} className="auth-form" autoComplete="on">
          {error && <p role="alert" className="form-error">{error}</p>}
          <Field id="email" label="Adresse e-mail">
            <input id="email" className="input" name="email" type="email" autoComplete="email" required />
          </Field>
          <button className="button" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Envoi…" : "Envoyer le lien"}</button>
        </form>
      )}
    </AuthShell>
  );
}
