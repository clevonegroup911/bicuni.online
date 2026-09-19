import { AdminShell } from "@/components/admin/admin-shell";
import { ReconciliationActions } from "@/components/admin/reconciliation-actions";
import { requirePermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { formatMoney } from "@/lib/billing/format";
import { maskEmail, maskPhone } from "@/lib/payments/clevone/references";
import { notFound } from "next/navigation";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { ProofLink } from "@/components/admin/proof-link";

export const metadata = { title: "Dossier de rapprochement" };

export default async function ReconciliationCasePage({ params }: { params: Promise<{ ref: string }> }) {
  const user = await requirePermission("admin:payments:read");
  const { ref } = await params;
  const intent = await clevonePayments.getByPublicRef(ref, { id: user.id, admin: true }).catch((error) => {
    if (error instanceof ClevonePaymentError && error.status === 404) notFound();
    throw error;
  });
  const latest = intent.attempts[0];
  return (
      <AdminShell user={user}>
        <div className="admin-page">
          <header className="admin-title">
            <span className="eyebrow">Rapprochement</span>
            <h1>{intent.publicRef}</h1>
            <p>Statut {intent.status} · risque {intent.riskLevel} · {intent.matchClass ?? "n/a"}</p>
          </header>
          <div className="admin-dashboard-grid">
            <section className="glass card admin-panel">
              <h2>Facture</h2>
              <dl className="profile-dl">
                <dt>Compte</dt><dd>{intent.user.name ?? maskEmail(intent.user.email)}</dd>
                <dt>Plan</dt><dd>{intent.plan.name}</dd>
                <dt>Montant</dt><dd>{formatMoney(intent.amountCents, intent.currency)}</dd>
                <dt>Canal</dt><dd>{intent.channel}</dd>
                <dt>Destinataire</dt><dd>{intent.destinationAccount}</dd>
                <dt>Échéance</dt><dd>{intent.expiresAt.toLocaleString("fr-FR")}</dd>
              </dl>
            </section>
            <section className="glass card admin-panel">
              <h2>Preuve normalisée</h2>
              {latest ? (
                <dl className="profile-dl">
                  <dt>Payeur</dt><dd>{latest.payerName}</dd>
                  <dt>Téléphone</dt><dd>{maskPhone(latest.payerPhone)}</dd>
                  <dt>Réf. fournisseur</dt><dd>{latest.providerTxnRef}</dd>
                  <dt>Montant déclaré</dt><dd>{formatMoney(latest.amountCents, latest.currency)}</dd>
                  <dt>Date déclarée</dt><dd>{latest.paidAtClient.toLocaleString("fr-FR")}</dd>
                  <dt>Compte déclaré</dt><dd>{latest.destinationAccount}</dd>
                </dl>
              ) : <p className="muted">Aucune preuve déposée.</p>}
              <ul>
                {intent.proofs.map((proof) => (
                  <li key={proof.id}>
                    {proof.fileName} · {proof.scanStatus} · {proof.sizeBytes} octets
                    {proof.isUploaded ? <ProofLink publicRef={intent.publicRef} proofId={proof.id} /> : null}
                  </li>
                ))}
              </ul>
            </section>
            <section className="glass card admin-panel">
              <h2>Historique</h2>
              <ol>
                {intent.transitions.map((item) => (
                  <li key={item.id}>{item.createdAt.toLocaleString("fr-FR")} · {item.fromStatus} → {item.toStatus} · {item.reason}</li>
                ))}
              </ol>
            </section>
            <section className="glass card admin-panel">
              <h2>Décisions</h2>
              {intent.decisions.length ? intent.decisions.map((decision) => (
                <p key={decision.id}><strong>{decision.action}</strong> — {decision.reason} <small>{decision.actor.name ?? maskEmail(decision.actor.email)}</small></p>
              )) : <p className="muted">Aucune décision humaine.</p>}
              <ReconciliationActions
                publicRef={intent.publicRef}
                canReview={can(user.role, "admin:payments:review")}
                canConfirm={can(user.role, "admin:payments:confirm")}
              />
            </section>
          </div>
        </div>
      </AdminShell>
    );
}
