"use client";

import { useState } from "react";

export function CheckoutButton({ planSlug, planName, featured }: {
  planSlug: string;
  planName: string;
  featured?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(`/pricing?plan=${planSlug}`)}`);
        return;
      }
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setError(result.error ?? "Paiement momentanément indisponible.");
        setPending(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Paiement momentanément indisponible. Réessayez.");
      setPending(false);
    }
  }

  return <>
    <button type="button" className={`button block ${featured ? "" : "secondary"}`} onClick={checkout} disabled={pending} aria-busy={pending}>
      {pending ? "Redirection vers le paiement…" : `Choisir ${planName}`}
    </button>
    {error ? <p role="alert" className="form-error checkout-error">{error}</p> : null}
  </>;
}
