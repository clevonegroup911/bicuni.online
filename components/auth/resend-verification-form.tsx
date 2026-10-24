"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/field";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/auth/email-verification-messages";

export function ResendVerificationForm({
  defaultEmail = "",
  compact = false,
}: {
  defaultEmail?: string;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const result = await response.json() as { message?: string };
      setMessage(result.message ?? RESEND_NEUTRAL_MESSAGE);
    } catch {
      setMessage(RESEND_NEUTRAL_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? "auth-resend-compact" : "auth-form"}>
      {!compact && (
        <p className="muted">Vous n’avez pas reçu l’email ? Demandez un nouveau lien.</p>
      )}
      <Field id="resend-email" label={compact ? "Renvoyer la vérification" : "Adresse e-mail"}>
        <input
          id="resend-email"
          name="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
          placeholder="vous@universite.edu"
        />
      </Field>
      <button className="button secondary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Envoi…" : "Renvoyer le lien de vérification"}
      </button>
      {message && <p role="status" className="form-success">{message}</p>}
    </form>
  );
}
