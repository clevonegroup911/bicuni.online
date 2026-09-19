"use client";

import { useMemo, useState } from "react";
import type { ClevoneAccounts, PaymentChannelId } from "@/lib/payments/clevone/accounts";
import { CopyField } from "@/components/payments/copy-field";
import { payCopy, statusLabel, type PayLocale } from "@/lib/payments/clevone/locale";
import { MAX_PROOF_BYTES } from "@/lib/payments/clevone/types";

type PayIntentView = {
  publicRef: string;
  status: string;
  amountCents: number;
  currency: string;
  channel: PaymentChannelId;
  expiresAt: string;
  expired: boolean;
  planName: string;
  destination: ClevoneAccounts["destinations"][PaymentChannelId];
  destinations: ClevoneAccounts["destinations"];
  holder: string;
  swift: string;
  receipt: { number: string; fingerprint: string } | null;
  fx: { rateUnits: number; source: string; effectiveAt: string } | null;
};

function money(cents: number, currency: string, locale: PayLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { style: "currency", currency }).format(cents / 100);
}

export function PayWorkspace({ intent, initialLocale }: { intent: PayIntentView; initialLocale: PayLocale }) {
  const [locale, setLocale] = useState<PayLocale>(initialLocale);
  const [tab, setTab] = useState<"MPESA" | "RAWBANK">(intent.channel === "MPESA" ? "MPESA" : "RAWBANK");
  const [status, setStatus] = useState(intent.status);
  const [phase, setPhase] = useState<"idle" | "uploading" | "success" | "error" | "duplicate" | "expired">("idle");
  const [message, setMessage] = useState("");
  const copy = payCopy(locale);
  const expired = status === "EXPIRED" || intent.expired;
  const paid = status === "PAID";
  const destination = intent.destination;

  const bankAccount = useMemo(() => {
    if (tab === "MPESA") return destination.channel === "MPESA" ? destination : null;
    return destination.channel === "MPESA" ? null : destination;
  }, [destination, tab]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (expired) {
      setPhase("expired");
      setMessage(copy.expired);
      return;
    }
    const form = new FormData(event.currentTarget);
    const file = form.get("proof") as File | null;
    if (!file || file.size === 0) {
      setPhase("error");
      setMessage(locale === "en" ? "A JPG, PNG or PDF proof is required." : "Une preuve JPG, PNG ou PDF est requise.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setPhase("error");
      setMessage(locale === "en" ? "File too large (5 MB max)." : "Fichier trop volumineux (5 Mo max).");
      return;
    }
    setPhase("uploading");
    setMessage("");
    try {
      const created = await fetch(`/api/payments/clevone/${intent.publicRef}/proof`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerName: String(form.get("payerName") ?? ""),
          payerPhone: String(form.get("payerPhone") ?? ""),
          providerTxnRef: String(form.get("providerTxnRef") ?? ""),
          amountCents: Number(form.get("amountCents")),
          currency: String(form.get("currency") ?? intent.currency),
          paidAtClient: new Date(String(form.get("paidAtClient") ?? "")).toISOString(),
          destinationAccount: destination.account,
          invoiceRef: intent.publicRef,
          fileName: file.name,
          mimeType: file.type === "image/jpg" ? "image/jpeg" : file.type,
          sizeBytes: file.size,
        }),
      });
      const payload = await created.json().catch(() => ({})) as { uploadUrl?: string; proofId?: string; error?: string; code?: string; status?: string };
      if (created.status === 409 && payload.code === "DUPLICATE") {
        setPhase("duplicate");
        setMessage(payload.error ?? "Doublon.");
        return;
      }
      if (created.status === 410) {
        setPhase("expired");
        setStatus("EXPIRED");
        setMessage(payload.error ?? copy.expired);
        return;
      }
      if (!created.ok || !payload.uploadUrl || !payload.proofId) {
        setPhase("error");
        setMessage(payload.error ?? "Dépôt de preuve impossible.");
        return;
      }
      const upload = await fetch(payload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) {
        setPhase("error");
        setMessage(locale === "en" ? "Private upload failed." : "Téléversement privé impossible.");
        return;
      }
      const confirmed = await fetch(`/api/payments/clevone/${intent.publicRef}/proof/confirm`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofId: payload.proofId }),
      });
      if (!confirmed.ok && confirmed.status !== 202) {
        const fail = await confirmed.json().catch(() => ({})) as { error?: string };
        setPhase("error");
        setMessage(fail.error ?? "Analyse du fichier refusée.");
        return;
      }
      setStatus(payload.status ?? "REVIEW_REQUIRED");
      setPhase("success");
      setMessage(copy.proofNotPaid);
    } catch {
      setPhase("error");
      setMessage(locale === "en" ? "Network error during proof submission." : "Erreur réseau lors du dépôt de preuve.");
    }
  }

  return (
    <article className="pay-workspace glass card">
      <div className="pay-toolbar">
        <p className={`admin-status ${status.toLowerCase()}`}>{statusLabel(status, locale)}</p>
        <div className="pay-lang" role="group" aria-label="Language">
          <button type="button" className={locale === "fr" ? "button" : "button secondary"} onClick={() => setLocale("fr")}>FR</button>
          <button type="button" className={locale === "en" ? "button" : "button secondary"} onClick={() => setLocale("en")}>EN</button>
          <button type="button" className="button secondary" onClick={() => window.print()}>{locale === "en" ? "Print" : "Imprimer"}</button>
        </div>
      </div>
      <header className="pay-invoice">
        <span className="eyebrow">{paid ? copy.invoicePaid : copy.invoicePending}</span>
        <h1>{intent.planName}</h1>
        <p><strong>{money(intent.amountCents, intent.currency, locale)}</strong> · {intent.currency}</p>
        {intent.fx ? (
          <p className="muted">
            1 USD = {intent.fx.rateUnits} CDF<br />
            {locale === "en" ? "Source" : "Source"} : {intent.fx.source}<br />
            {locale === "en" ? "Valid since" : "Valable depuis"} : {new Date(intent.fx.effectiveAt).toLocaleString(locale === "en" ? "en-GB" : "fr-FR")}
          </p>
        ) : null}
        <p>{locale === "en" ? "Reference" : "Référence"} : <code>{intent.publicRef}</code></p>
        <p>{locale === "en" ? "Due" : "Échéance"} : {new Date(intent.expiresAt).toLocaleString(locale === "en" ? "en-GB" : "fr-FR")}</p>
      </header>

      <p className="form-error" role="note">{copy.proofNotPaid}</p>

      <div className="pay-tabs" role="tablist" aria-label="Payment method">
        <button type="button" role="tab" aria-selected={tab === "MPESA"} className={tab === "MPESA" ? "button" : "button secondary"} onClick={() => setTab("MPESA")}>M-PESA</button>
        <button type="button" role="tab" aria-selected={tab === "RAWBANK"} className={tab === "RAWBANK" ? "button" : "button secondary"} onClick={() => setTab("RAWBANK")}>RAWBANK</button>
      </div>

      <section role="tabpanel" className="pay-instructions">
        <p><strong>{intent.holder}</strong></p>
        {tab === "MPESA" ? (
          <>
            <CopyField
              label="M-PESA"
              value={intent.destinations.MPESA.account}
              locale={locale}
            />
            <p className="muted">{locale === "en" ? intent.destinations.MPESA.instructionsEn : intent.destinations.MPESA.instructionsFr}</p>
          </>
        ) : (
          <>
            <CopyField label={`RAWBANK USD${intent.channel === "RAWBANK_USD" ? " · facture" : ""}`} value={intent.destinations.RAWBANK_USD.account} locale={locale} />
            <CopyField label={`RAWBANK CDF${intent.channel === "RAWBANK_CDF" ? " · facture" : ""}`} value={intent.destinations.RAWBANK_CDF.account} locale={locale} />
            <CopyField label="SWIFT/BIC" value={intent.swift} locale={locale} />
            <p className="muted">{locale === "en" ? "Use only the account that matches this invoice currency." : "Utilisez uniquement le compte correspondant à la devise de cette facture."}</p>
          </>
        )}
        {tab === "RAWBANK" && intent.channel === "MPESA" ? (
          <p className="form-error">{locale === "en" ? "This invoice is M-PESA only." : "Cette facture est payable uniquement par M-PESA."}</p>
        ) : null}
        {tab === "MPESA" && intent.channel !== "MPESA" ? (
          <p className="form-error">{locale === "en" ? "This invoice is a RAWBANK transfer." : "Cette facture est un virement RAWBANK."}</p>
        ) : null}
      </section>

      {paid && intent.receipt ? (
        <p className="form-success"><a className="auth-link" href={`/pay/${intent.publicRef}/receipt`}>Reçu {intent.receipt.number}</a></p>
      ) : null}

      {!paid && !expired ? (
        <form className="auth-form pay-proof" onSubmit={(event) => void submit(event)}>
          <label>
            {locale === "en" ? "Transaction reference" : "Référence de transaction"}
            <input className="input" name="providerTxnRef" required minLength={4} maxLength={64} autoComplete="off" />
          </label>
          <label>
            {locale === "en" ? "Payer name" : "Nom du payeur"}
            <input className="input" name="payerName" required minLength={2} maxLength={80} autoComplete="name" />
          </label>
          <label>
            {locale === "en" ? "Phone" : "Téléphone"}
            <input className="input" name="payerPhone" required inputMode="tel" autoComplete="tel" />
          </label>
          <label>
            {locale === "en" ? "Amount (minor units)" : "Montant (unités minimales)"}
            <input className="input" name="amountCents" type="number" required defaultValue={intent.amountCents} />
          </label>
          <label>
            {locale === "en" ? "Currency" : "Devise"}
            <input className="input" name="currency" required defaultValue={intent.currency} maxLength={3} />
          </label>
          <label>
            {locale === "en" ? "Date and time" : "Date/heure"}
            <input className="input" name="paidAtClient" type="datetime-local" required />
          </label>
          <label>
            {locale === "en" ? "Proof (JPG, PNG, PDF — 5 MB)" : "Preuve (JPG, PNG, PDF — 5 Mo)"}
            <input className="input" name="proof" type="file" required accept="image/jpeg,image/png,application/pdf" />
          </label>
          <button className="button" type="submit" disabled={phase === "uploading"} aria-busy={phase === "uploading"}>
            {phase === "uploading" ? (locale === "en" ? "Submitting…" : "Envoi…") : (locale === "en" ? "Submit proof" : "Déposer la preuve")}
          </button>
        </form>
      ) : null}

      {phase !== "idle" ? (
        <p role="status" className={phase === "success" ? "form-success" : "form-error"}>{message}</p>
      ) : null}
      {bankAccount ? <span className="sr-only">{bankAccount.label}</span> : null}
    </article>
  );
}
