# Back Office BICUNI

## Prérequis

Configurer `DATABASE_URL`, `AUTH_SECRET` et `AUTH_URL` à partir de `.env.example`. Pour l'initialisation unique, renseigner aussi `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME` et `SUPER_ADMIN_PASSWORD`. Le mot de passe doit contenir au moins 12 caractères et respecter les règles affichées par le script.

## Installation et migration

```bash
npm ci
npm run db:generate
npm run db:migrate:status
npm run db:migrate:deploy
npm run admin:init
npm run dev
```

`admin:init` est idempotent : il ne modifie pas un super-administrateur actif existant et refuse toute conversion implicite d'un compte ordinaire. Après la première connexion, retirer les trois variables `SUPER_ADMIN_*` de l'environnement d'exécution et les conserver uniquement dans un gestionnaire de secrets.

Les bases historiques créées avec `prisma db push` doivent d'abord suivre la procédure non destructive de [baseline Prisma](./prisma-migrate-baseline.md). Ne jamais lancer `prisma migrate reset` sur une base contenant des données.

## Accès et sécurité

Le Back Office est disponible sous `/admin`. Les pages et API sont protégées côté serveur. Les rôles administratifs sont `SUPER_ADMIN`, `ADMIN`, `MODERATOR` et `INSTITUTION_ADMIN`; les rôles académiques historiques restent compatibles. Seul un `SUPER_ADMIN` peut créer un administrateur ou modifier les rôles et statuts. Le dernier super-administrateur actif ne peut pas être rétrogradé, suspendu ou supprimé.

Les comptes publics sont créés avec le rôle `USER` et le statut `PENDING`, puis deviennent `ACTIVE` après vérification de l'adresse électronique. Les traces d'audit stockent l'action, l'acteur, la cible, les valeurs avant/après, un hash de l'adresse IP et un user-agent tronqué; aucun mot de passe ni jeton n'est journalisé.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

En cas de perte d'accès, utiliser un accès contrôlé à PostgreSQL pour réactiver un super-administrateur existant après validation d'identité et consigner manuellement l'intervention. Ne pas relancer le bootstrap avec l'adresse d'un utilisateur ordinaire.
