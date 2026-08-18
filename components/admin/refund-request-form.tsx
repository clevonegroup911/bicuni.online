"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/field";
import { ADMIN_REFUNDS_PATH } from "@/lib/billing/contracts";
import { parseWriteResponse, sessionLoginHref } from "@/lib/ui/write-api";

const MISSING = "La demande de remboursement n’est pas disponible : POST /api/admin/refunds est absent. Aucun remboursement n’a été simulé.";

export function RefundRequestForm({ onCreated }: { onCreated?: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(formElement);
    const payload = {
      paymentId: String(form.get("paymentId") ?? "").trim(),
      amountCents: Number(form.get("amountCents")),
      reason: String(form.get("reason") ?? "").trim(),
    };
    try {
      const response = await fetch(ADMIN_REFUNDS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = await parseWriteResponse(response);
      if (!result.ok) {
        if (result.kind === "session") {
          window.location.assign(sessionLoginHref("/admin/refunds"));
          return;
        }
        setPending(false);
        setError(result.kind === "missing" ? MISSING : result.message);
        return;
      }
      setPending(false);
      setSuccess("Demande enregistrée.");
      formElement.reset();
      onCreated?.();
    } catch {
      setPending(false);
      setError("Demande momentanément indisponible.");
    }
  }

  return (
    <form className="glass card admin-panel" onSubmit={submit}>
      <h2>Demander un remboursement</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      <div className="form-grid">
        <Field id="refund-payment" label="Identifiant de transaction">
          <input id="refund-payment" className="input" name="paymentId" required autoComplete="off" />
        </Field>
        <Field id="refund-amount" label="Montant (centimes)">
          <input id="refund-amount" className="input" name="amountCents" type="number" min={1} required />
        </Field>
        <label className="span-2" htmlFor="refund-reason">Motif
          <textarea id="refund-reason" className="input textarea" name="reason" required minLength={8} maxLength={500} />
        </label>
      </div>
      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Envoi…" : "Envoyer la demande"}
      </button>
    </form>
  );
}
