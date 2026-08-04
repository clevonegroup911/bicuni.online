"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
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
  }

  return <AuthShell eyebrow={<><UserPlus size={15}/> Inscription</>} title="Rejoindre BICUNI." description="Créez votre identité académique sécurisée."
    footer={<>Déjà membre ? <Link href="/login" className="auth-link">Se connecter</Link></>}>
    {message ? <p role="status" className="form-success">{message}</p> :
      <form onSubmit={submit} className="auth-form">
        {error && <p role="alert" className="form-error">{error}</p>}
        <label>Nom complet<input name="name" className="input" autoComplete="name" required minLength={2}/></label>
        <label>Adresse e-mail<input name="email" className="input" type="email" autoComplete="email" required/></label>
        <label>Mot de passe<input name="password" className="input" type="password" autoComplete="new-password" required minLength={12}/><small>12 caractères, avec majuscule, minuscule et chiffre.</small></label>
        <button className="button" disabled={pending}>{pending ? "Création…" : "Créer mon compte"}</button>
      </form>}
  </AuthShell>;
}
