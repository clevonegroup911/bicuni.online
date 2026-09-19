/**
 * Catalogue OaaS — tarifs indicatifs uniquement.
 * Les montants ne sont pas des tarifs contractuels définitifs sans validation propriétaire.
 */

export type OutcomePackDefinition = {
  slug: string;
  title: string;
  summary: string;
  resultDescription: string;
  requiredInputs: string[];
  indicativeDeadlineDays: number;
  revisionsIncluded: number;
  acceptanceCriteria: string[];
  confidentialityDefault: "STANDARD" | "RESTRICTED" | "CONFIDENTIAL" | "STRICT";
  pricingMode: "FIXED" | "QUOTE";
  /** Proposition commerciale indicative — non contractuelle sans validation. */
  indicativePriceCents: number | null;
  planSlug: string | null;
  sortOrder: number;
};

export const OUTCOME_PACK_CATALOG: readonly OutcomePackDefinition[] = [
  {
    slug: "verified-bibliography",
    title: "Pack Bibliographie vérifiée",
    summary: "Bibliographie annotée et normalisée à partir de sources fournies ou vérifiables.",
    resultDescription: "Bibliographie annotée, références normalisées, sources rejetées motivées, Evidence Ledger.",
    requiredInputs: ["Sujet", "Format de citation", "Critères de source", "Documents ou corpus fournis"],
    indicativeDeadlineDays: 5,
    revisionsIncluded: 1,
    acceptanceCriteria: [
      "Aucune source inventée",
      "Chaque entrée normalisée selon le format demandé",
      "Sources inaccessibles signalées",
    ],
    confidentialityDefault: "STANDARD",
    pricingMode: "QUOTE",
    indicativePriceCents: null,
    planSlug: "oaas-verified-bibliography",
    sortOrder: 10,
  },
  {
    slug: "academic-research",
    title: "Pack Recherche académique vérifiée",
    summary: "Dossier de recherche sourcé : problématique, thèmes, sources, synthèse et preuves.",
    resultDescription:
      "Problématique reformulée, carte des thèmes, tableau des sources, bibliographie annotée, synthèse sourcée, limites, Evidence Ledger, rapport final.",
    requiredInputs: [
      "Sujet",
      "Question de recherche",
      "Domaine",
      "Niveau académique",
      "Langue",
      "Période",
      "Documents fournis",
      "Critères de source",
      "Format de citation",
      "Délai",
    ],
    indicativeDeadlineDays: 10,
    revisionsIncluded: 1,
    acceptanceCriteria: [
      "Aucune source inventée",
      "Aucun DOI inventé",
      "Affirmations importantes rattachées à une source",
      "Distinction fait / inférence / proposition",
      "Provenance conservée",
    ],
    confidentialityDefault: "STANDARD",
    pricingMode: "FIXED",
    /** Tarif TEST indicatif local — figé au devis serveur, pas un tarif production. */
    indicativePriceCents: 4900,
    planSlug: "oaas-academic-research",
    sortOrder: 20,
  },
  {
    slug: "publication",
    title: "Pack Publication",
    summary: "Préparation éditoriale d’un manuscrit et dossier de publication.",
    resultDescription: "Manuscrit structuré, checklist éditoriale, dossier de soumission, avertissements d’intégrité.",
    requiredInputs: ["Manuscrit", "Revue ou cible", "Consignes éditoriales"],
    indicativeDeadlineDays: 14,
    revisionsIncluded: 2,
    acceptanceCriteria: ["Pas d’usurpation d’auteur", "Divulgation IA si requise", "Références vérifiées"],
    confidentialityDefault: "RESTRICTED",
    pricingMode: "QUOTE",
    indicativePriceCents: null,
    planSlug: "oaas-publication",
    sortOrder: 30,
  },
  {
    slug: "institutional-digitization",
    title: "Pack Numérisation institutionnelle",
    summary: "Conversion et indexation d’un lot documentaire institutionnel.",
    resultDescription: "Lot numérisé, métadonnées, index, rapport de conformité.",
    requiredInputs: ["Volume estimé", "Formats sources", "Politique de confidentialité"],
    indicativeDeadlineDays: 30,
    revisionsIncluded: 1,
    acceptanceCriteria: ["Traçabilité des lots", "Métadonnées minimales complètes"],
    confidentialityDefault: "CONFIDENTIAL",
    pricingMode: "QUOTE",
    indicativePriceCents: null,
    planSlug: "oaas-institutional-digitization",
    sortOrder: 40,
  },
  {
    slug: "archives-indexing",
    title: "Pack Archives et indexation",
    summary: "Classification et indexation d’un fonds documentaire.",
    resultDescription: "Schéma de classification, index, inventaire, Evidence Ledger.",
    requiredInputs: ["Description du fonds", "Schéma souhaité", "Contraintes d’accès"],
    indicativeDeadlineDays: 21,
    revisionsIncluded: 1,
    acceptanceCriteria: ["Aucune métadonnée inventée", "Sources d’attribution documentées"],
    confidentialityDefault: "RESTRICTED",
    pricingMode: "QUOTE",
    indicativePriceCents: null,
    planSlug: "oaas-archives-indexing",
    sortOrder: 50,
  },
  {
    slug: "custom-mission",
    title: "Mission personnalisée",
    summary: "Résultat académique ou documentaire sur mesure, devis obligatoire.",
    resultDescription: "Contrat de résultat adapté à la demande, plan d’exécution et livrables définis.",
    requiredInputs: ["Objectif", "Contraintes", "Budget maximal", "Délai"],
    indicativeDeadlineDays: 14,
    revisionsIncluded: 1,
    acceptanceCriteria: ["Critères d’acceptation formalisés dans le contrat"],
    confidentialityDefault: "STANDARD",
    pricingMode: "QUOTE",
    indicativePriceCents: null,
    planSlug: null,
    sortOrder: 100,
  },
] as const;

export function getOutcomePack(slug: string) {
  return OUTCOME_PACK_CATALOG.find((pack) => pack.slug === slug) ?? null;
}

export function formatIndicativePrice(priceCents: number | null) {
  if (priceCents == null) return "Sur devis";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
