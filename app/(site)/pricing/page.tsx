import type { Metadata } from "next";
import { Check, Crown } from "lucide-react";
import { GOVERNMENT_PLAN, PLAN_CATALOG, formatPlanPrice } from "@/lib/subscriptions/catalog";
import { CheckoutButton } from "@/components/subscriptions/checkout-button";

export const metadata: Metadata = { title: "Tarifs" };

export default async function Pricing({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const subscriptionRequired = (await searchParams).required === "1";
  return <main className="shell">
    <header className="page-hero" style={{ textAlign: "center" }}>
      <span className="eyebrow">Abonnements BICUNI</span>
      <h1>Investir dans le savoir.</h1>
      <p style={{ marginInline: "auto" }}>Des offres transparentes pour chaque étape du parcours académique. Chaque abonnement finance la préservation du savoir.</p>
      {subscriptionRequired && <p role="alert" className="form-error" style={{ maxWidth: 650, margin: "20px auto 0" }}>Un abonnement actif est nécessaire pour accéder à cet espace.</p>}
    </header>
    <section className="pricing-grid">
      {PLAN_CATALOG.map((plan) => {
        const featured = plan.slug === "student-premium";
        return <article className="glass card" key={plan.slug} style={{ padding: 25, borderColor: featured ? "#435fff" : undefined, position: "relative" }}>
          {featured && <span style={{ position: "absolute", right: 15, top: 15, color: "#ff6d78", fontSize: 11, fontWeight: 900 }}>RECOMMANDÉ</span>}
          <Crown color={featured ? "#e60012" : "#657dff"}/>
          <h2>{plan.name}</h2>
          <div><strong style={{ fontSize: 40 }}>{formatPlanPrice(plan.priceCents)}</strong><span style={{ color: "var(--muted)" }}> / mois</span></div>
          <p style={{ color: "var(--muted)", minHeight: 48 }}>{plan.description}</p>
          <CheckoutButton planSlug={plan.slug} planName={plan.name} featured={featured}/>
          <div style={{ marginTop: 24, display: "grid", gap: 12 }}>{plan.features.map((feature) => <span key={feature} style={{ display: "flex", gap: 9, alignItems: "center", color: "#c6ccda", fontSize: 14 }}><Check size={16} color="#5f79ff"/>{feature}</span>)}</div>
        </article>;
      })}
    </section>
    <section className="glass card" style={{ margin: "25px 0 80px", padding: 30, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}>
      <div><span className="eyebrow">{GOVERNMENT_PLAN.name}</span><h2>{GOVERNMENT_PLAN.description}</h2></div>
      <a className="button red" href="mailto:institutions@bicuni.online">Parler à BICUNI</a>
    </section>
    <style>{`.pricing-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:25px}@media(max-width:1000px){.pricing-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.pricing-grid{grid-template-columns:1fr}}`}</style>
  </main>;
}
