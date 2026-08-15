import type { Metadata } from "next";
import { Check, Crown } from "lucide-react";
import { GOVERNMENT_PLAN, PLAN_CATALOG, formatPlanPrice } from "@/lib/subscriptions/catalog";
import { CheckoutButton } from "@/components/subscriptions/checkout-button";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const metadata: Metadata = { title: "Tarifs" };

export default async function Pricing({ searchParams }: { searchParams: Promise<{ required?: string; plan?: string }> }) {
  const params = await searchParams;
  const subscriptionRequired = params.required === "1";
  const selectedPlan = PLAN_CATALOG.some((plan) => plan.slug === params.plan) ? params.plan : undefined;
  return (
    <main className="shell">
      <header className="page-hero pricing-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Plans" }]} />
        <span className="eyebrow">Abonnements BICUNI</span>
        <h1>Investir dans le savoir.</h1>
        <p className="pricing-note">Des offres transparentes pour chaque étape du parcours académique. Chaque abonnement finance la préservation du savoir. Aucune formule gratuite permanente.</p>
        <p className="pricing-note">Les montants affichés sont des propositions commerciales, pas encore un tarif contractuel définitif. Un paiement n’est jamais simulé : la confirmation vient exclusivement du prestataire.</p>
        {subscriptionRequired ? (
          <p role="alert" className="form-error pricing-alert">
            Un abonnement actif est nécessaire pour accéder à cet espace.
          </p>
        ) : null}
      </header>
      <section className="pricing-grid">
        {PLAN_CATALOG.map((plan) => {
          const featured = selectedPlan ? plan.slug === selectedPlan : plan.slug === "student-premium";
          return (
            <article className={`glass card pricing-card ${featured ? "featured" : ""}`} key={plan.slug} id={plan.slug}>
              {featured ? <span className="pricing-label">{plan.slug === selectedPlan ? "Sélectionné" : "Recommandé"}</span> : null}
              <Crown color={featured ? "#e60012" : "#657dff"} />
              <h2>{plan.name}</h2>
              <div className="price">
                <strong>{formatPlanPrice(plan.priceCents)}</strong>
                <span>/ mois · USD</span>
              </div>
              <p>{plan.description}</p>
              <CheckoutButton planSlug={plan.slug} planName={plan.name} featured={featured} />
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><Check size={16} />{feature}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
      <section className="glass card pricing-enterprise">
        <div>
          <span className="eyebrow">{GOVERNMENT_PLAN.name}</span>
          <h2>{GOVERNMENT_PLAN.description}</h2>
        </div>
        <a className="button red" href="mailto:institutions@bicuni.online">Parler à BICUNI</a>
      </section>
    </main>
  );
}
