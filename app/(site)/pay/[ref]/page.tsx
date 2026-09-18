import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PayWorkspace } from "@/components/payments/pay-workspace";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { getClevoneAccounts } from "@/lib/payments/clevone/accounts";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { payLocale } from "@/lib/payments/clevone/locale";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";

export const metadata: Metadata = { title: "Paiement CLEVONE" };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const user = await requireUser();
  const { ref } = await params;
  const { lang } = await searchParams;
  const intent = await clevonePayments.getByPublicRef(ref, {
    id: user.id,
    admin: can(user.role, "admin:payments:read"),
  }).catch((error) => {
    if (error instanceof ClevonePaymentError && error.status === 404) notFound();
    throw error;
  });
  const accounts = getClevoneAccounts();
  return (
    <main className="shell pay-page">
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Paiement" }]} />
      <PayWorkspace
        initialLocale={payLocale(lang)}
        intent={{
          publicRef: intent.publicRef,
          status: intent.status,
          amountCents: intent.amountCents,
          currency: intent.currency,
          channel: intent.channel,
          expiresAt: intent.expiresAt.toISOString(),
          expired: intent.status === "EXPIRED",
          planName: intent.plan.name,
          destination: accounts.destinations[intent.channel],
          destinations: accounts.destinations,
          holder: accounts.holder,
          swift: accounts.swift,
          receipt: intent.receipt ? { number: intent.receipt.publicNumber, fingerprint: intent.receipt.fingerprint } : null,
          fx: intent.fxRateUnits && intent.fxSource && intent.fxEffectiveAt
            ? { rateUnits: intent.fxRateUnits, source: intent.fxSource, effectiveAt: intent.fxEffectiveAt.toISOString() }
            : null,
        }}
      />
    </main>
  );
}
