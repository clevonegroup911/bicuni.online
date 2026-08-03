export const PLAN_CATALOG = [
  {
    slug: "starter",
    name: "Starter",
    priceCents: 200,
    audience: "STUDENT",
    description: "L’essentiel pour lire et organiser.",
    features: ["Accès bibliothèque", "Lecture en ligne", "Profil académique", "Stockage limité"],
  },
  {
    slug: "student-premium",
    name: "Étudiant Premium",
    priceCents: 700,
    audience: "STUDENT",
    description: "Étudier plus vite avec les outils documentaires.",
    features: ["Téléchargements étendus", "Assistant académique", "OCR", "Bibliographies", "Stockage étendu"],
  },
  {
    slug: "researcher",
    name: "Chercheur",
    priceCents: 2400,
    audience: "RESEARCHER",
    description: "Publier, mesurer et faire rayonner ses travaux.",
    features: ["Publication avancée", "Identifiant interne", "Analytics d’impact", "Indexation", "Outils IA"],
  },
  {
    slug: "university",
    name: "Université",
    priceCents: 10000,
    audience: "UNIVERSITY_ADMIN",
    description: "Une infrastructure académique institutionnelle.",
    features: ["Portail personnalisé", "Bibliothèque privée", "Multi-administrateurs", "Archivage massif", "Support prioritaire"],
  },
] as const;

export const GOVERNMENT_PLAN = {
  slug: "government",
  name: "Gouvernement",
  description: "Contrat souverain adapté aux programmes nationaux.",
} as const;

export function formatPlanPrice(priceCents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}
