import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { PrintButton } from "@/components/payments/print-button";
import { formatMoney } from "@/lib/billing/format";

export const metadata: Metadata = { title: "Reçu CLEVONE" };

export default async function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const user = await requireUser();
  const { ref } = await params;
  const intent = await clevonePayments.getByPublicRef(ref, {
    id: user.id,
    admin: can(user.role, "admin:payments:read"),
  }).catch((error) => {
    if (error instanceof ClevonePaymentError && error.status === 404) notFound();
    throw error;
  });
  if (intent.status !== "PAID" || !intent.receipt) notFound();
  return (
    <main className="shell pay-receipt">
      <article className="glass card pay-print">
        <span className="eyebrow">Reçu acquitté</span>
        <h1>{intent.receipt.publicNumber}</h1>
        <p>Facture {intent.publicRef} — {intent.plan.name}</p>
        <dl className="profile-dl">
          <dt>Montant</dt><dd>{formatMoney(intent.receipt.amountCents, intent.receipt.currency)}</dd>
          <dt>Devise</dt><dd>{intent.receipt.currency}</dd>
          <dt>Canal</dt><dd>{intent.receipt.channel}</dd>
          <dt>Confirmation</dt><dd>{intent.receipt.confirmedAt.toLocaleString("fr-FR")}</dd>
          <dt>Empreinte</dt><dd className="admin-checksum">{intent.receipt.fingerprint}</dd>
        </dl>
        <p className="muted">Ce reçu n’est émis qu’après l’état PAID. Une preuve client n’est pas une confirmation bancaire.</p>
        <PrintButton label="Imprimer le reçu" />
      </article>
    </main>
  );
}
