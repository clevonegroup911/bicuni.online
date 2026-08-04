"use client";

import { signIn, signOut } from "next-auth/react";
import { FormEvent, useState } from "react";

const adminRoles = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"]);

export function AdminLoginForm() {
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
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <label>Email administratif<input className="input" type="email" name="email" autoComplete="username" required /></label>
      <label>Mot de passe<input className="input" type="password" name="password" autoComplete="current-password" required /></label>
      <button className="button" disabled={pending}>{pending ? "Vérification…" : "Accéder au Back Office"}</button>
    </form>
  );
}
