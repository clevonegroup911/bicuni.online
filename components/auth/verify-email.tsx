"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export function VerifyEmail({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Vérification de votre adresse…");

  useEffect(() => {
    if (!token || !email) {
      setState("error");
      setMessage("Lien de vérification incomplet.");
      return;
    }
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
