"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function VerifyEmail({ token, email }: { token: string; email: string }) {
  const isComplete = Boolean(token && email);
  const [state, setState] = useState<"pending" | "success" | "error">(isComplete ? "pending" : "error");
  const [message, setMessage] = useState(isComplete ? "Vérification de votre adresse…" : "Lien de vérification incomplet.");

  useEffect(() => {
    if (!token || !email) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    }).then(async (response) => {
      const result = await response.json() as { message?: string; error?: string };
      setState(response.ok ? "success" : "error");
      setMessage(result.message ?? result.error ?? "Vérification impossible.");
    }).catch(() => {
      setState("error");
      setMessage("Vérification momentanément indisponible.");
    });
  }, [email, token]);

  return (
    <AuthShell
      eyebrow={<><MailCheck size={15} /> Vérification</>}
      title="Confirmer votre adresse."
      description="Cette étape protège votre identité académique."
      footer={state === "success" ? <Link href="/login?verified=1" className="auth-link">Continuer vers la connexion</Link> : undefined}
    >
      {state === "pending" ? <p role="status" className="muted">{message}</p> : (
        <p role="status" className={state === "error" ? "form-error" : "form-success"}>{message}</p>
      )}
    </AuthShell>
  );
}
