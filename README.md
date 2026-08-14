# BICUNI.ONLINE

Socle SaaS de la Bibliothèque Centrale Universelle : Next.js 15, TypeScript, Prisma/PostgreSQL, RBAC et déploiement Cloud Run.

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Lancer PostgreSQL et Meilisearch avec `docker compose up -d`.
3. Installer avec `npm install`, puis `npm run db:generate` (cela recrée le lockfile).
4. Créer le schéma avec `npm run db:push`.
5. Démarrer avec `npm run dev`.

Les pages publiques utilisent des données de démonstration. Les intégrations Stripe, Google Cloud Storage, Auth.js, Meilisearch et IA disposent de leur structure, mais nécessitent leurs secrets et une configuration fournisseur avant production.

Les identifiants pérennes internes (**BICUNI PID**, distincts d’un DOI officiellement enregistré) sont décrits dans [docs/persistent-identifiers.md](docs/persistent-identifiers.md).
