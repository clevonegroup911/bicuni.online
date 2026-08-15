"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";

export function LoginForm({ callbackUrl, verified }: { callbackUrl: string; verified: boolean }) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
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
    } catch {
      setError("Connexion momentanément indisponible. Réessayez.");
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow={<><LockKeyhole size={15} /> Espace sécurisé</>}
      title="Bon retour."
      description="Accédez à votre espace académique BICUNI."
      footer={<>Nouveau sur BICUNI ? <Link href="/signup" className="auth-link">Créer un compte</Link></>}
    >
      {verified && <p role="status" className="form-success">Adresse vérifiée. Vous pouvez vous connecter.</p>}
      {error && <p id="login-error" role="alert" className="form-error">{error}</p>}
      <form onSubmit={submit} className="auth-form">
        <Field id="email" label="Adresse e-mail">
          <div className="field-with-icon">
            <Mail size={17} />
            <input id="email" name="email" className="input" type="email" autoComplete="email" required placeholder="vous@universite.edu" aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} />
          </div>
        </Field>
        <Field id="password" label="Mot de passe">
          <div className="password-field">
            <input id="password" name="password" className="input" type={show ? "text" : "password"} autoComplete="current-password" required aria-invalid={Boolean(error)} />
            <button type="button" onClick={() => setShow(!show)} className="icon-button" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <Link href="/forgot-password" className="auth-link">Mot de passe oublié ?</Link>
        <button className="button" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
      </form>
    </AuthShell>
  );
}
