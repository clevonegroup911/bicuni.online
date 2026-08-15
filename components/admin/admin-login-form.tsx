"use client";

import { signIn, signOut } from "next-auth/react";
import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/field";

const adminRoles = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"]);

export function AdminLoginForm() {
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
        setError("Identifiants invalides ou accès administratif indisponible.");
        setPending(false);
        return;
      }
      const sessionResponse = await fetch("/api/auth/session");
      const session = (await sessionResponse.json()) as { user?: { role?: string } };
      if (!session.user?.role || !adminRoles.has(session.user.role)) {
        await signOut({ redirect: false });
        setError("Identifiants invalides ou accès administratif indisponible.");
        setPending(false);
        return;
      }
      window.location.assign("/admin/dashboard");
    } catch {
      setError("Connexion administrative momentanément indisponible.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Field id="admin-email" label="Email administratif">
        <input id="admin-email" className="input" type="email" name="email" autoComplete="username" required />
      </Field>
      <Field id="admin-password" label="Mot de passe">
        <input id="admin-password" className="input" type="password" name="password" autoComplete="current-password" required />
      </Field>
      <button className="button" disabled={pending} aria-busy={pending}>{pending ? "Vérification…" : "Accéder au Back Office"}</button>
    </form>
  );
}
