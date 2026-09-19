import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Suivi de paiement" };

export default async function TrackPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  await requireUser();
  const { ref } = await searchParams;
  if (ref?.startsWith("CLEV-")) redirect(`/pay/${ref}`);
  return (
    <main className="shell pay-page">
      <h1>Suivi par référence</h1>
      <form className="auth-form glass card" action="/pay/track" method="get">
        <label>
          Référence de facture
          <input className="input" name="ref" required placeholder="CLEV-20260918-ABCD1234" />
        </label>
        <button className="button" type="submit">Ouvrir le suivi</button>
      </form>
    </main>
  );
}
