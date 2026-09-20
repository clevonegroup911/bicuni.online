"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OUTCOME_PACK_CATALOG } from "@/lib/oaas/catalog";

const steps = [
  "Résultat attendu",
  "Contexte",
  "Sources",
  "Contraintes",
  "Confidentialité",
  "Délai",
  "Critères d’acceptation",
  "Estimation",
  "Contrat",
  "Paiement",
] as const;

export function MissionWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packSlug = searchParams.get("pack") ?? "academic-research";
  const pack = OUTCOME_PACK_CATALOG.find((p) => p.slug === packSlug) ?? OUTCOME_PACK_CATALOG[1];

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [missionId, setMissionId] = useState<string | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: pack.title,
    expectedOutcome: pack.resultDescription,
    originalRequest: "",
    academicDomain: "",
    academicLevel: "",
    language: "fr",
    scope: "",
    exclusions: "Aucune source inventée. Hors devoir frauduleux.",
    confidentiality: pack.confidentialityDefault,
    deadlineDays: String(pack.indicativeDeadlineDays),
    maxBudgetCents: "",
    acceptanceCriteria: pack.acceptanceCriteria.join("\n"),
    sourceLabel: "",
    sourceUri: "",
    priceCents: "15000",
    depositCents: "6000",
  });

  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createAndQualify() {
    setError(null);
    const sources = form.sourceLabel.trim()
      ? [{ label: form.sourceLabel.trim(), uri: form.sourceUri.trim() || undefined, accessible: true }]
      : [];
    const res = await fetch("/api/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packSlug: pack.slug,
        title: form.title,
        expectedOutcome: form.expectedOutcome,
        originalRequest: form.originalRequest || form.expectedOutcome,
        language: form.language,
        academicDomain: form.academicDomain || undefined,
        academicLevel: form.academicLevel || undefined,
        scope: form.scope || undefined,
        exclusions: form.exclusions || undefined,
        confidentiality: form.confidentiality,
        deadlineAt: new Date(Date.now() + Number(form.deadlineDays || 10) * 86400000).toISOString(),
        maxBudgetCents: form.maxBudgetCents ? Number(form.maxBudgetCents) : null,
        acceptanceCriteria: form.acceptanceCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        sources,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Création impossible");
    const id = data.mission.id as string;
    setMissionId(id);
    const q = await fetch(`/api/outcomes/${id}?action=qualify`, { method: "POST" });
    const qd = await q.json();
    if (!q.ok) throw new Error(qd.error ?? "Qualification impossible");
    return id;
  }

  async function quote(id: string) {
    const res = await fetch(`/api/outcomes/${id}?action=quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        priceCents: Number(form.priceCents),
        depositCents: Number(form.depositCents),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Devis impossible");
    return data;
  }

  async function acceptContract(id: string) {
    const res = await fetch(`/api/outcomes/${id}?action=contract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "accept" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Acceptation impossible");
    return data;
  }

  async function checkout(id: string) {
    const key = `oaas:${id}:${Date.now()}`;
    const res = await fetch(`/api/outcomes/${id}?action=checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "MPESA", idempotencyKey: key }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Checkout impossible");
    setPayRef(data.publicRef);
    return data.publicRef as string;
  }

  function next() {
    startTransition(async () => {
      try {
        setError(null);
        if (step === 6) {
          const id = missionId ?? (await createAndQualify());
          setMissionId(id);
          setStep(7);
          return;
        }
        if (step === 7) {
          if (!missionId) throw new Error("Mission manquante");
          await quote(missionId);
          setStep(8);
          return;
        }
        if (step === 8) {
          if (!missionId) throw new Error("Mission manquante");
          await acceptContract(missionId);
          setStep(9);
          return;
        }
        if (step === 9) {
          if (!missionId) throw new Error("Mission manquante");
          const ref = await checkout(missionId);
          router.push(`/pay/${ref}`);
          return;
        }
        setStep((s) => Math.min(s + 1, steps.length - 1));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <div className="glass card" style={{ padding: "1.5rem", maxWidth: 720 }}>
      <p className="eyebrow">Assistant de mission · {pack.title}</p>
      <h1 style={{ marginBottom: "0.5rem" }}>{steps[step]}</h1>
      <div aria-hidden style={{ height: 6, background: "#e8ecf5", borderRadius: 999, marginBottom: "1.25rem" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "#e60012", borderRadius: 999 }} />
      </div>

      {step === 0 ? (
        <label className="field">
          Résultat attendu
          <textarea value={form.expectedOutcome} onChange={(e) => update("expectedOutcome", e.target.value)} rows={5} required />
        </label>
      ) : null}
      {step === 1 ? (
        <>
          <label className="field">
            Titre
            <input value={form.title} onChange={(e) => update("title", e.target.value)} />
          </label>
          <label className="field">
            Demande / question de recherche
            <textarea value={form.originalRequest} onChange={(e) => update("originalRequest", e.target.value)} rows={4} />
          </label>
          <label className="field">
            Domaine
            <input value={form.academicDomain} onChange={(e) => update("academicDomain", e.target.value)} />
          </label>
          <label className="field">
            Niveau académique
            <input value={form.academicLevel} onChange={(e) => update("academicLevel", e.target.value)} placeholder="Master, Doctorat…" />
          </label>
          <label className="field">
            Langue
            <input value={form.language} onChange={(e) => update("language", e.target.value)} />
          </label>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="pricing-note">Fournissez uniquement des sources réelles. BICUNI n’invente aucune référence.</p>
          <label className="field">
            Libellé source
            <input value={form.sourceLabel} onChange={(e) => update("sourceLabel", e.target.value)} />
          </label>
          <label className="field">
            URI (optionnel)
            <input value={form.sourceUri} onChange={(e) => update("sourceUri", e.target.value)} placeholder="https://…" />
          </label>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <label className="field">
            Périmètre
            <textarea value={form.scope} onChange={(e) => update("scope", e.target.value)} rows={3} />
          </label>
          <label className="field">
            Exclusions
            <textarea value={form.exclusions} onChange={(e) => update("exclusions", e.target.value)} rows={3} />
          </label>
        </>
      ) : null}
      {step === 4 ? (
        <label className="field">
          Confidentialité
          <select value={form.confidentiality} onChange={(e) => update("confidentiality", e.target.value as typeof form.confidentiality)}>
            <option value="STANDARD">STANDARD</option>
            <option value="RESTRICTED">RESTRICTED</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            <option value="STRICT">STRICT</option>
          </select>
        </label>
      ) : null}
      {step === 5 ? (
        <>
          <label className="field">
            Délai (jours, indicatif)
            <input type="number" min={1} value={form.deadlineDays} onChange={(e) => update("deadlineDays", e.target.value)} />
          </label>
          <label className="field">
            Budget maximal (cents USD, optionnel)
            <input type="number" min={0} value={form.maxBudgetCents} onChange={(e) => update("maxBudgetCents", e.target.value)} />
          </label>
        </>
      ) : null}
      {step === 6 ? (
        <label className="field">
          Critères d’acceptation (un par ligne)
          <textarea value={form.acceptanceCriteria} onChange={(e) => update("acceptanceCriteria", e.target.value)} rows={6} />
        </label>
      ) : null}
      {step === 7 ? (
        <>
          <p className="pricing-note">
            Prix serveur pour ce pack :{" "}
            {pack.indicativePriceCents != null
              ? `${(pack.indicativePriceCents / 100).toFixed(2)} USD (mission ponctuelle)`
              : "devis manuel — aucun tarif fixe"}
            . Le montant client n’est pas utilisé si un tarif pack est défini.
          </p>
          {pack.indicativePriceCents == null ? (
            <>
              <label className="field">
                Prix total (cents USD)
                <input type="number" min={0} value={form.priceCents} onChange={(e) => update("priceCents", e.target.value)} />
              </label>
              <label className="field">
                Acompte (cents USD)
                <input type="number" min={0} value={form.depositCents} onChange={(e) => update("depositCents", e.target.value)} />
              </label>
            </>
          ) : null}
        </>
      ) : null}
      {step === 8 ? (
        <p>
          Le contrat de résultat sera émis avec objectif, livrables, critères, acompte/solde, révisions, confidentialité et
          avertissements d’intégrité. En continuant, vous acceptez ce contrat.
        </p>
      ) : null}
      {step === 9 ? (
        <p>
          Paiement TEST local (recommandé en développement) ou paiement manuel CLEVONE. Stripe OaaS reste{" "}
          <strong>ADAPTER_NOT_CONFIGURED</strong>. Aucune fausse confirmation Stripe. {payRef ? `Réf. ${payRef}` : null}
        </p>
      ) : null}

      {error ? <p role="alert" className="form-error">{error}</p> : null}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
        <button type="button" className="button secondary" disabled={pending || step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Retour
        </button>
        {step === 9 ? (
          <>
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setError(null);
                    if (!missionId) throw new Error("Mission manquante");
                    const key = `oaas-test:${missionId}:${Date.now()}`;
                    const res = await fetch(`/api/outcomes/${missionId}?action=pay-test`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ idempotencyKey: key }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Paiement TEST impossible");
                    router.push(`/dashboard/missions/${missionId}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur");
                  }
                })
              }
            >
              {pending ? "Traitement…" : "Confirmer paiement TEST"}
            </button>
            <button type="button" className="button secondary" disabled={pending} onClick={next}>
              Paiement CLEVONE manuel
            </button>
          </>
        ) : (
          <button type="button" className="button" disabled={pending} onClick={next}>
            {pending ? "Traitement…" : "Continuer"}
          </button>
        )}
      </div>
    </div>
  );
}
