"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sessionLoginHref } from "@/lib/ui/write-api";

const CHECKOUT_TIMEOUT_MS = 25_000;

type CheckoutPhase =
  | "idle"
  | "auth"
  | "creating"
  | "redirecting"
  | "error"
  | "unconfigured";

function isSafeCheckoutUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (
      parsed.hostname === "checkout.stripe.com"
      || parsed.hostname.endsWith(".stripe.com")
      || parsed.hostname === "billing.stripe.com"
    );
  } catch {
    return false;
  }
}

function labelForPhase(phase: CheckoutPhase, planName: string, retry: boolean) {
  if (phase === "auth") return "Connexion…";
  if (phase === "creating") return "Création de la session…";
  if (phase === "redirecting") return "Redirection…";
  if (retry) return `Réessayer — ${planName}`;
  return `Choisir ${planName}`;
}

export function CheckoutButton({
  planSlug,
  planName,
  featured,
  autoStart = false,
}: {
  planSlug: string;
  planName: string;
  featured?: boolean;
  autoStart?: boolean;
}) {
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(false);
  const autoStarted = useRef(false);
  const statusId = useId();
  const pending = phase === "auth" || phase === "creating" || phase === "redirecting";

  async function checkout() {
    if (pending) return;

    setError("");
    setRetry(false);
    setPhase("creating");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS);
    const idempotencyKey = `ui:${planSlug}:${crypto.randomUUID()}`;

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        credentials: "same-origin",
        body: JSON.stringify({ planSlug }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        setPhase("auth");
        window.location.assign(sessionLoginHref(`/pricing?plan=${planSlug}&resume=1`));
        return;
      }

      const result = await response.json().catch(() => ({})) as { url?: string; error?: string; mode?: string };

      if (response.status === 503) {
        setPhase("unconfigured");
        setError(result.error ?? "Le paiement n’est pas encore configuré sur ce serveur.");
        setRetry(true);
        return;
      }

      if (!response.ok || !result.url) {
        setPhase("error");
        setError(result.error ?? "Paiement momentanément indisponible.");
        setRetry(true);
        return;
      }

      if (!isSafeCheckoutUrl(result.url)) {
        setPhase("error");
        setError("URL de paiement invalide. Aucune redirection n’a été effectuée.");
        setRetry(true);
        return;
      }

      setPhase("redirecting");
      window.location.assign(result.url);
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "AbortError";
      setPhase("error");
      setError(timedOut
        ? "Délai dépassé lors de la création du paiement. Réessayez."
        : "Paiement momentanément indisponible. Réessayez.");
      setRetry(true);
    } finally {
      window.clearTimeout(timer);
    }
  }

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void checkout();
    // Auto-resume after login must run once for the selected plan only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <>
      <button
        type="button"
        className={`button block ${featured ? "" : "secondary"}`}
        onClick={() => void checkout()}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? statusId : undefined}
      >
        {labelForPhase(phase, planName, retry)}
      </button>
      <p id={statusId} role="status" aria-live="polite" className={error ? "form-error checkout-error" : "sr-only"}>
        {error || (pending ? labelForPhase(phase, planName, false) : "")}
      </p>
    </>
  );
}
