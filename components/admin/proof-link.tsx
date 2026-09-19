"use client";

import { useState } from "react";

export function ProofLink({ publicRef, proofId }: { publicRef: string; proofId: string }) {
  const [error, setError] = useState("");

  async function openProof() {
    setError("");
    const response = await fetch(`/api/admin/reconciliation/${publicRef}/proofs/${proofId}`, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setError(payload.error ?? "Preuve indisponible.");
      return;
    }
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      {" "}
      <button type="button" className="button secondary" onClick={() => void openProof()}>Ouvrir (URL signée)</button>
      {error ? <span className="field-error">{error}</span> : null}
    </>
  );
}
