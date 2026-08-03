import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const plans = [
  ["starter", "Starter", 200, ["Accès bibliothèque", "Lecture en ligne", "Profil académique", "Stockage limité"]],
  ["student-premium", "Étudiant Premium", 700, ["Téléchargements étendus", "Assistant académique", "OCR", "Bibliographies", "Stockage étendu"]],
  ["researcher", "Chercheur", 2400, ["Publication avancée", "Identifiant interne", "Analytics d’impact", "Indexation", "Outils IA"]],
  ["university", "Université", 10000, ["Portail personnalisé", "Bibliothèque privée", "Multi-administrateurs", "Archivage massif", "Support prioritaire"]],
  ["government", "Gouvernement", 0, ["Accès institutionnel", "Statistiques nationales", "Pilotage académique", "Support institutionnel"]],
];

try {
  for (const [slug, name, priceCents, features] of plans) {
    await db.plan.upsert({
      where: { slug },
      update: { name, priceCents, features, active: true },
      create: { slug, name, priceCents, features },
    });
  }
  console.info(`${plans.length} plans BICUNI synchronisés.`);
} finally {
  await db.$disconnect();
}
