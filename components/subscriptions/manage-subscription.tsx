"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  STRIPE_PORTAL_PATH,
  SUBSCRIPTION_CANCEL_PATH,
} from "@/lib/billing/contracts";
import { parseWriteResponse, sessionLoginHref } from "@/lib/ui/write-api";

const PORTAL_MISSING = "Le portail Stripe n’est pas encore exposé (POST /api/payments/portal). Aucune redirection n’a été simulée.";
const CANCEL_MISSING = "L’annulation en libre-service n’est pas encore exposée (POST /api/subscriptions/cancel). Aucune annulation n’a été simulée.";

export function ManageSubscription({
  stripeConfigured,
  canCancel,
  cancelScheduled,
}: {
  stripeConfigured: boolean;
  canCancel: boolean;
  cancelScheduled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"portal" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function openPortal() {
    setPending("portal");
    setError("");
    try {
      const response = await fetch(STRIPE_PORTAL_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ returnUrl: "/dashboard/subscription" }),
      });
      const result = await parseWriteResponse<{ url?: string; error?: string }>(response);
      if (!result.ok) {
        if (result.kind === "session") {
          window.location.assign(sessionLoginHref("/dashboard/subscription"));
          return;
        }
        setPending(null);
        setError(result.kind === "missing" ? PORTAL_MISSING : result.message);
        return;
      }
      if (!result.data.url) {
        setPending(null);
        setError("Le serveur n’a pas renvoyé d’URL de portail. Aucune redirection n’a été fabriquée.");
        return;
      }
      window.location.assign(result.data.url);
    } catch {
      setPending(null);
      setError("Portail de facturation momentanément indisponible.");
    }
  }

  async function cancelAtPeriodEnd() {
    setPending("cancel");
    setError("");
    try {
      const response = await fetch(SUBSCRIPTION_CANCEL_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ atPeriodEnd: true }),
      });
      const result = await parseWriteResponse(response);
      if (!result.ok) {
        if (result.kind === "session") {
          window.location.assign(sessionLoginHref("/dashboard/subscription"));
          return;
        }
        setPending(null);
        setConfirmOpen(false);
        setError(result.kind === "missing" ? CANCEL_MISSING : result.message);
        return;
      }
      setConfirmOpen(false);
      setPending(null);
      router.refresh();
    } catch {
      setPending(null);
      setError("Annulation momentanément indisponible.");
    }
  }

  if (!stripeConfigured) {
    return (
      <p className="form-error billing-banner" role="status">
        Stripe n’est pas configuré sur ce serveur. Le portail client et l’annulation en libre-service sont indisponibles. Aucun paiement n’est simulé.
      </p>
    );
  }

  return (
    <div className="action-cluster">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="document-toolbar">
        <button
          type="button"
          className="button"
          onClick={openPortal}
          disabled={pending !== null}
          aria-busy={pending === "portal"}
        >
          {pending === "portal" ? "Ouverture du portail…" : "Gérer dans Stripe"}
        </button>
        {canCancel && !cancelScheduled ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={pending !== null}
          >
            Annuler à l’échéance
          </button>
        ) : null}
      </div>
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmer l’annulation">
        <p>L’accès reste actif jusqu’à la fin de la période déjà payée. Aucun remboursement n’est déclenché depuis cet écran.</p>
        <div className="admin-form-actions stack-top">
          <button
            type="button"
            className="button red"
            onClick={cancelAtPeriodEnd}
            disabled={pending !== null}
            aria-busy={pending === "cancel"}
          >
            {pending === "cancel" ? "Demande en cours…" : "Confirmer l’annulation"}
          </button>
          <button type="button" className="button secondary" onClick={() => setConfirmOpen(false)} disabled={pending !== null}>
            Revenir
          </button>
        </div>
      </Modal>
    </div>
  );
}
