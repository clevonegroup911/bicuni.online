"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function LoginForm({ callbackUrl, verified }: { callbackUrl: string; verified: boolean }) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    if (result?.error) {
      setError("Identifiants invalides ou adresse email non vérifiée.");
      setPending(false);
      return;
    }
    window.location.assign(callbackUrl);
  }

  return <AuthShell
    eyebrow={<><LockKeyhole size={15}/> Espace sécurisé</>}
    title="Bon retour."
    description="Accédez à votre espace académique BICUNI."
    footer={<>Nouveau sur BICUNI ? <Link href="/signup" style={{ color: "#8295ff", fontWeight: 800 }}>Créer un compte</Link></>}
  >
    {verified && <p role="status" className="form-success">Adresse vérifiée. Vous pouvez vous connecter.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <form onSubmit={submit} className="auth-form">
      <label>Adresse e-mail<div className="field-with-icon"><Mail size={17}/><input name="email" className="input" type="email" autoComplete="email" required placeholder="vous@universite.edu"/></div></label>
      <label>Mot de passe<div className="password-field"><input name="password" className="input" type={show ? "text" : "password"} autoComplete="current-password" required/><button type="button" onClick={() => setShow(!show)} className="icon-button" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
      <Link href="/forgot-password" className="auth-link">Mot de passe oublié ?</Link>
      <button className="button" type="submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
    </form>
  </AuthShell>;
}
