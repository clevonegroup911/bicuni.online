"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/field";
import { ADMIN_COUPONS_PATH } from "@/lib/billing/contracts";
import { parseWriteResponse, sessionLoginHref } from "@/lib/ui/write-api";

const MISSING = "La création de coupon n’est pas disponible : POST /api/admin/coupons est absent. Aucun code n’a été créé.";

export function CouponForm({ onCreated }: { onCreated?: () => void }) {
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
      code: String(form.get("code") ?? "").trim(),
      type: String(form.get("type") ?? ""),
      value: Number(form.get("value")),
      validFrom: String(form.get("validFrom") || "") || null,
      validUntil: String(form.get("validUntil") || "") || null,
      maxRedemptions: String(form.get("maxRedemptions") || "") ? Number(form.get("maxRedemptions")) : null,
    };
    try {
      const response = await fetch(ADMIN_COUPONS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = await parseWriteResponse(response);
      if (!result.ok) {
        if (result.kind === "session") {
          window.location.assign(sessionLoginHref("/admin/coupons"));
          return;
        }
        setPending(false);
        setError(result.kind === "missing" ? MISSING : result.message);
        return;
      }
      setPending(false);
      setSuccess("Coupon créé.");
      formElement.reset();
      onCreated?.();
    } catch {
      setPending(false);
      setError("Création momentanément indisponible.");
    }
  }

  return (
    <form className="glass card admin-panel" onSubmit={submit}>
      <h2>Créer un coupon</h2>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      <div className="form-grid">
        <Field id="coupon-code" label="Code">
          <input id="coupon-code" className="input" name="code" required maxLength={40} autoComplete="off" />
        </Field>
        <Field id="coupon-type" label="Type">
          <select id="coupon-type" className="input" name="type" required defaultValue="percent">
            <option value="percent">Pourcentage</option>
            <option value="amount">Montant</option>
          </select>
        </Field>
        <Field id="coupon-value" label="Valeur" hint="Pourcentage (1–100) ou centimes selon le type.">
          <input id="coupon-value" className="input" name="value" type="number" min={1} required />
        </Field>
        <Field id="coupon-max" label="Limite d’utilisation">
          <input id="coupon-max" className="input" name="maxRedemptions" type="number" min={1} />
        </Field>
        <Field id="coupon-from" label="Début de validité">
          <input id="coupon-from" className="input" name="validFrom" type="date" />
        </Field>
        <Field id="coupon-until" label="Fin de validité">
          <input id="coupon-until" className="input" name="validUntil" type="date" />
        </Field>
      </div>
      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Création…" : "Créer le coupon"}
      </button>
    </form>
  );
}
