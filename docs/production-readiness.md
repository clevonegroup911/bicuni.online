# Préparation production — sécurité et services

## CSP et origines

La CSP est générée par `lib/security/headers.ts`. En production, les origines de scripts sont limitées à l’application et `js.stripe.com`; `unsafe-eval` et les jokers sont absents. `unsafe-inline` reste temporairement nécessaire pour les scripts bootstrap Next.js et les attributs de style de l’UI actuelle. La cible de durcissement est une nonce générée par requête et propagée par le middleware, après validation de l’impact sur le rendu statique. Les PDF privés sont affichés dans une iframe via URL signée; `frame-src` autorise donc `self`, `blob:` et Google Cloud Storage. Définir `GCS_PUBLIC_ORIGIN` uniquement pour un domaine CDN HTTPS distinct.

Les polices utilisent une pile système locale : le build ne télécharge plus Inter ou Poppins depuis Google Fonts. Les avatars distants sont limités aux URL HTTPS; `img-src https:` est volontairement nécessaire pour afficher les origines choisies par les utilisateurs sans ouvrir les scripts, connexions ou frames à ces domaines.

## Redis et rate limiting

`REDIS_URL` active le compteur partagé multi-instance. `REDIS_KEY_PREFIX` sépare les environnements; les identifiants sont hachés avant stockage et les clés expirent avec la fenêtre. Connexion et commandes ont des timeouts courts configurables. En cas de panne, le comportement fail-safe explicite est un repli vers un compteur mémoire par instance: l’authentification reste disponible mais la protection globale est dégradée. Les événements sont journalisés sans URL Redis, clé, IP ni email. Superviser `redis.rate_limit_*` et alerter sur tout repli en production.

## Email

Configurer `RESEND_API_KEY`, `EMAIL_FROM` et `PUBLIC_APP_URL` (HTTPS en production). Les liens de vérification expirent après 24 h et les liens de réinitialisation après 1 h. Les jetons sont aléatoires et seulement leur empreinte est stockée. L’oubli de mot de passe répond de façon neutre. Resend est appelé avec un timeout de 5 s et jusqu’à trois tentatives pour les erreurs transitoires; aucun destinataire ou jeton n’est journalisé.

## Baseline PostgreSQL existante

Ne jamais utiliser `prisma migrate reset` sur une base existante.

1. Geler les écritures applicatives et créer une sauvegarde `pg_dump --format=custom`; tester sa restauration dans une base isolée.
2. Exécuter `npx prisma db pull --print` pour capturer le schéma réel, sans remplacer automatiquement `prisma/schema.prisma`.
3. Exécuter `npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --script` et examiner chaque écart.
4. Base neuve: utiliser uniquement `npm run db:migrate:deploy`.
5. Base existante créée par `db push`: identifier seulement les migrations dont les objets sont déjà réellement présents. Exécuter d’abord `npm run db:baseline` (dry-run), puis renseigner explicitement `BASELINE_MIGRATIONS=0_init,... npm run db:baseline:execute` après approbation.
6. Exécuter `npx prisma migrate status`, puis `npm run db:migrate:deploy` uniquement pour les migrations encore non appliquées.
7. Valider les contraintes, volumes de lignes, parcours d’authentification et paiements en sandbox.

Rollback: arrêter l’application et restaurer le dump dans une nouvelle base PostgreSQL, valider cette restauration, puis basculer `DATABASE_URL`. Ne pas tenter de rollback en supprimant arbitrairement des lignes de `_prisma_migrations`.

## Coupons et remboursements

Le schéma ne contient pas encore de règles métier pour coupons ou remboursements. Avant toute migration, définir: ownership, fournisseurs couverts, états transactionnels, motifs, approbateurs, montants maximums, idempotence, journal d’audit et réconciliation webhook. Aucune table spéculative n’est ajoutée par BIC-SEC-002.
