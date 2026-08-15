# BICUNI.ONLINE

Socle SaaS de la Bibliothèque Centrale Universelle : Next.js 15, TypeScript, Prisma/PostgreSQL, RBAC et déploiement Cloud Run.

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Lancer PostgreSQL et Meilisearch avec `docker compose up -d`.
3. Installer avec `npm install`, puis `npm run db:generate` (cela recrée le lockfile).
4. Pour une base locale jetable uniquement, créer le schéma avec `npm run db:push`.
5. Démarrer avec `npm run dev`.

En préproduction et en production, ne pas utiliser `db:push` : appliquer les migrations versionnées avec `npm run db:migrate:deploy`. Une base historique créée avec `db:push` doit d’abord suivre la procédure de baseline décrite dans [docs/prisma-migrate-baseline.md](docs/prisma-migrate-baseline.md), sans réinitialisation des données.

Les pages publiques utilisent des données de démonstration. Les intégrations Stripe, Google Cloud Storage, Auth.js, Meilisearch et IA disposent de leur structure, mais nécessitent leurs secrets et une configuration fournisseur avant production.

Les identifiants pérennes internes (**BICUNI PID**, distincts d’un DOI officiellement enregistré) sont décrits dans [docs/persistent-identifiers.md](docs/persistent-identifiers.md).

## Héritage PHP

Les fichiers PHP et `.htaccess` à la racine constituent l’application historique. Ils ne sont ni copiés dans l’image d’exécution du `Dockerfile`, ni utilisés par les routes Next.js. Ils restent conservés pour analyse/migration et ne doivent pas être servis avec l’application Cloud Run moderne. Leur archivage ou retrait devra faire l’objet d’une opération séparée et contrôlée.
