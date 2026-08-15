"use client";

import { Eye, EyeOff, UserPlus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";

export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json() as { message?: string; error?: string };
      setPending(false);
      if (!response.ok) return setError(result.error ?? "Inscription impossible.");
      setMessage(result.message ?? "Compte créé.");
      event.currentTarget.reset();
    } catch {
      setPending(false);
      setError("Inscription momentanément indisponible. Réessayez.");
    }
  }

  return (
    <AuthShell
      eyebrow={<><UserPlus size={15} /> Inscription</>}
      title="Rejoindre BICUNI."
      description="Créez votre identité académique sécurisée."
      footer={<>Déjà membre ? <Link href="/login" className="auth-link">Se connecter</Link></>}
    >
      {message ? (
        <>
          <p role="status" className="form-success">{message}</p>
          <Link href="/login" className="button secondary">Se connecter</Link>
        </>
      ) : (
        <form onSubmit={submit} className="auth-form">
          {error && <p id="register-error" role="alert" className="form-error">{error}</p>}
          <Field id="name" label="Nom complet">
            <input id="name" name="name" className="input" autoComplete="name" required minLength={2} />
          </Field>
          <Field id="email" label="Adresse e-mail">
            <input id="email" name="email" className="input" type="email" autoComplete="email" required />
          </Field>
          <Field id="password" label="Mot de passe" hint="12 caractères, avec majuscule, minuscule et chiffre.">
            <div className="password-field">
              <input id="password" name="password" className="input" type={show ? "text" : "password"} autoComplete="new-password" required minLength={12} aria-describedby="password-hint" />
              <button type="button" onClick={() => setShow(!show)} className="icon-button" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <button className="button" disabled={pending} aria-busy={pending}>{pending ? "Création…" : "Créer mon compte"}</button>
        </form>
      )}
    </AuthShell>
  );
}
