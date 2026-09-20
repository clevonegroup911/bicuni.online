import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { OUTCOME_PACK_CATALOG, formatIndicativePrice } from "@/lib/oaas/catalog";

export const metadata: Metadata = { title: "Résultats commandables" };

export default async function OutcomesPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string; pack?: string }>;
}) {
  const params = await searchParams;
  const accessRequired = params.required === "1";

  return (
    <main className="shell">
      <header className="page-hero pricing-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Résultats" }]} />
        <span className="eyebrow">BICUNI OaaS</span>
        <h1>Commander un résultat académique.</h1>
        <p className="pricing-note">
          BICUNI transforme une demande de recherche, de publication ou d’archivage en un résultat vérifié, traçable et prêt à l’emploi.
          Vous ne payez pas principalement pour manipuler des outils — vous payez pour un résultat défini.
        </p>
        <p className="pricing-note">
          Les délais et montants affichés sont indicatifs. Aucun tarif n’est contractuel sans validation du contrat de résultat.
          Les anciens montants d’abonnement (2 / 7 / 24 / 100 USD) ne sont pas des tarifs OaaS.
        </p>
        {accessRequired ? (
          <p role="alert" className="form-error pricing-alert">
            Une mission OaaS ou un abonnement actif est nécessaire pour cet espace. Décrivez le résultat à obtenir ci-dessous.
          </p>
        ) : null}
        <div className="hero-actions" style={{ marginTop: "1.25rem" }}>
          <Link href="/dashboard/missions/new" className="button">
            Décrire le résultat à obtenir
            <ArrowRight size={17} />
          </Link>
          <Link href="/pricing" className="button secondary">
            Abonnements (offre secondaire)
          </Link>
        </div>
      </header>

      <section className="pricing-grid">
        {OUTCOME_PACK_CATALOG.map((pack) => {
          const featured = params.pack ? pack.slug === params.pack : pack.slug === "academic-research";
          return (
            <article
              className={`glass card pricing-card ${featured ? "featured" : ""}`}
              key={pack.slug}
              id={pack.slug}
            >
              {featured ? <span className="pricing-label">Recommandé</span> : null}
              <Target color={featured ? "#e60012" : "#657dff"} />
              <h2>{pack.title}</h2>
              <div className="price">
                <strong>{formatIndicativePrice(pack.indicativePriceCents)}</strong>
                <span>· {pack.pricingMode === "QUOTE" ? "devis" : "fixe"} · indicatif</span>
              </div>
              <p>{pack.summary}</p>
              <p><strong>Résultat livré :</strong> {pack.resultDescription}</p>
              <ul>
                <li>Délai indicatif : {pack.indicativeDeadlineDays} jours</li>
                <li>Révisions incluses : {pack.revisionsIncluded}</li>
                <li>Confidentialité : {pack.confidentialityDefault}</li>
              </ul>
              <p className="pricing-note">Entrées : {pack.requiredInputs.join(" · ")}</p>
              <p className="pricing-note">Acceptation : {pack.acceptanceCriteria.join(" · ")}</p>
              <Link
                href={`/dashboard/missions/new?pack=${pack.slug}`}
                className={`button ${featured ? "" : "secondary"}`}
              >
                Commander ce résultat
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
