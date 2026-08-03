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
  }

  return <>
    <button type="button" className={`button ${featured ? "" : "secondary"}`} style={{ width: "100%" }} onClick={checkout} disabled={pending}>
      {pending ? "Redirection…" : `Choisir ${planName}`}
    </button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </>;
}
