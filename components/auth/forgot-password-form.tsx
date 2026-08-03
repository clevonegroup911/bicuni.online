"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = new FormData(event.currentTarget).get("email");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const result = await response.json() as { message: string };
    setMessage(result.message);
    setPending(false);
  }
  return <AuthShell eyebrow={<><KeyRound size={15}/> Récupération</>} title="Retrouver votre accès." description="Nous vous enverrons un lien sécurisé valable une heure."
    footer={<Link href="/login" className="auth-link">Retour à la connexion</Link>}>
    {message ? <p role="status" className="form-success">{message}</p> : <form onSubmit={submit} className="auth-form"><label>Adresse e-mail<input className="input" name="email" type="email" autoComplete="email" required/></label><button className="button" disabled={pending}>{pending ? "Envoi…" : "Envoyer le lien"}</button></form>}
  </AuthShell>;
}
