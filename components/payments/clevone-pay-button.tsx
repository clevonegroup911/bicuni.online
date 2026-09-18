"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionLoginHref } from "@/lib/ui/write-api";
import { PAYMENT_CHANNELS, type PaymentChannelId } from "@/lib/payments/clevone/accounts";

const LABELS: Record<PaymentChannelId, string> = {
  MPESA: "M-PESA",
  RAWBANK_CDF: "RAWBANK CDF",
  RAWBANK_USD: "RAWBANK USD",
};

export function ClevonePayButton({ planSlug, planName }: { planSlug: string; planName: string }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<PaymentChannelId>("RAWBANK_USD");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [cdf, setCdf] = useState<{ available: boolean; label?: string; message?: string }>({ available: false });
  const statusId = useId();
  const router = useRouter();

  async function loadFx() {
    const response = await fetch("/api/payments/clevone/fx", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({})) as { available?: boolean; labelFr?: string; message?: string };
    setCdf({ available: Boolean(payload.available), label: payload.labelFr, message: payload.message });
  }

  async function start() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/payments/clevone/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `ui:${planSlug}:${channel}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ planSlug, channel }),
      });
      if (response.status === 401) {
        window.location.assign(sessionLoginHref(`/pricing?plan=${planSlug}&method=clevone`));
        return;
      }
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !result.url || !result.url.startsWith("/pay/")) {
        setError(result.error ?? "Impossible de créer la facture CLEVONE.");
        setPending(false);
        return;
      }
      router.push(result.url);
    } catch {
      setError("Paiement CLEVONE momentanément indisponible.");
      setPending(false);
    }
  }

  return (
    <div className="clevone-pay">
      <button type="button" className="button secondary block" onClick={() => {
        setOpen((value) => !value);
        if (!open) void loadFx();
      }} aria-expanded={open}>
        Payer par M-PESA / RAWBANK — {planName}
      </button>
      {open ? (
        <fieldset className="clevone-channels" disabled={pending}>
          <legend>Choisir le compte destinataire</legend>
          {PAYMENT_CHANNELS.map((item) => {
            const cdfChannel = item !== "RAWBANK_USD";
            const disabled = cdfChannel && !cdf.available;
            return (
              <label key={item}>
                <input
                  type="radio"
                  name={`channel-${planSlug}`}
                  checked={channel === item}
                  disabled={disabled}
                  onChange={() => setChannel(item)}
                />
                {LABELS[item]}{disabled ? " (indisponible)" : ""}
              </label>
            );
          })}
          {cdf.available ? <p className="muted">{cdf.label}</p> : <p className="muted">{cdf.message ?? "Paiement CDF indisponible tant qu’un taux USD/CDF n’est pas approuvé."}</p>}
          <button type="button" className="button block" onClick={() => void start()} disabled={pending} aria-busy={pending} aria-describedby={error ? statusId : undefined}>
            {pending ? "Création de la facture…" : "Continuer"}
          </button>
        </fieldset>
      ) : null}
      <p id={statusId} role="status" className={error ? "form-error" : "sr-only"}>{error}</p>
    </div>
  );
}
