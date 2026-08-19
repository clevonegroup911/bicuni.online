# Préparation production — sécurité et services

## Next.js 16 et fichiers de gouvernance

`next dev` 16.3.1 peut ajouter automatiquement un bloc `nextjs-agent-rules` à `AGENTS.md`. Ce bloc généré ne fait pas partie du système d’opération BICUNI et ne doit jamais être commité. Après tout démarrage du serveur de développement, restaurer `AGENTS.md` depuis le SHA de base autorisé et vérifier que `AGENTS.md`, `.agents/`, `.codex/` et `.cursor/rules/` sont identiques à cette base. Les consignes techniques Next.js restent dans cette documentation.

## Sondes HTTP

`GET /api/health/live` confirme uniquement que le processus répond (`200`, `{ "status": "ok", "check": "live" }`). `GET /api/health/ready` vérifie PostgreSQL et, en production ou lorsque `REDIS_URL` est défini, Redis, avec un délai borné. Aucun secret n’est renvoyé. Ces routes `/api/health/*` sont les chemins canoniques des sondes Cloud Run. `/health/live` et `/health/ready` restent uniquement des alias de compatibilité.

## Next.js 16, `tsc --showConfig` et `next-env.d.ts`

`next dev` peut réécrire `next-env.d.ts` vers `.next/dev/types` et ajouter `.next/dev/dev/types` dans `tsconfig.json`. La forme de production attendue importe `.next/types/routes.d.ts` et `.next/types/root-params.d.ts`. Next 16.3.1 peut réajouter `.next/dev/types/**/*.ts` dans `include` pendant `next build` : conserver cette entrée, mais ne jamais réintroduire le chemin doublé `.next/dev/dev/types`. Next 16 active `experimental.useTypeScriptCli` par défaut et fait `JSON.parse` de `tsc --showConfig` (chemin Webpack/`load-jsconfig`). `npx tsc` peut résoudre le paquet factice `tsc@2.0.4` (sortie ANSI, pas du JSON). BICUNI force `useTypeScriptCli: false` (API TypeScript 5.9) et `npm run typecheck` appelle `node ./node_modules/typescript/bin/tsc`.

## CSP et origines

La CSP est générée par `lib/security/headers.ts` et appliquée à la réponse via `proxy.ts` avec une nonce (`x-nonce`) et `strict-dynamic`. La même CSP est copiée sur les en-têtes de la requête pour que Next.js (`getScriptNonceFromHeader`) applique la nonce aux scripts du framework. En production, `script-src` n’inclut plus `unsafe-inline` lorsque la nonce est présente. **Exception résiduelle :** `style-src 'self' 'unsafe-inline'` reste nécessaire à cause des attributs `style={{ ... }}` de l’UI. `unsafe-eval` est limité au développement. HSTS (`max-age=31536000; includeSubDomains`) n’est émis qu’en production HTTPS. `upgrade-insecure-requests` n’est émis que lorsque l’origine publique configurée est HTTPS. Les PDF privés sont affichés dans une iframe via URL signée; `frame-src` autorise `self`, `blob:` et Google Cloud Storage. Définir `GCS_PUBLIC_ORIGIN` uniquement pour un domaine CDN HTTPS distinct.

Les polices utilisent une pile système locale : le build ne télécharge plus Inter ou Poppins depuis Google Fonts. `img-src` autorise uniquement l’application, les images `data:`/`blob:` effectivement utilisées par l’UI, `storage.googleapis.com` et l’éventuelle origine GCS HTTPS explicite. Les avatars hébergés sur une autre origine doivent être migrés vers une origine explicitement autorisée avant affichage; aucun joker ni schéma `https:` générique n’est accepté.

## Redis et rate limiting

`REDIS_URL` est obligatoire en production (Cloud Run multi-instance). Le repli `Map` est interdit lorsque `NODE_ENV=production`; une indisponibilité Redis échoue fermé (`503`). `TRUSTED_PROXY_STRATEGY=cloud-run` (défaut si `K_SERVICE` ou production) n’utilise que le dernier hop de `X-Forwarded-For` (GFE/Cloud Run). Les valeurs de tête, spoofables, et `X-Real-IP` sont ignorées. En local, `loopback` ignore `X-Forwarded-For`. `REDIS_KEY_PREFIX` sépare les environnements; les identifiants sont hachés. Journaliser `redis.rate_limit_*` sans URL, clé, IP ni email.

## Upload et analyse antivirus

La confirmation d’upload recalcule taille et SHA-256 côté serveur. `isUploaded=true` envoyé par le client est ignoré. Les états sont `PENDING` / `SCANNING` / `CLEAN` / `REJECTED`. Publication, catalogue public et téléchargement public exigent `CLEAN`. Le scanner reçoit le bucket privé, l’objectKey, la génération GCS disponible, le checksum serveur, la taille et le MIME; aucune URL publique permanente n’est transmise. En production, `ANTIVIRUS_SCANNER_AUTHORIZATION` est obligatoire. Sans endpoint ou authentification, sur timeout, réponse invalide, verdict ambigu ou checksum divergent, le résultat reste `unavailable` et le fichier `PENDING`, jamais `CLEAN`. Les fichiers existants migrés restent `PENDING` jusqu’à une analyse réelle.

## Email

Configurer `RESEND_API_KEY`, `EMAIL_FROM` et `PUBLIC_APP_URL` (HTTPS en production). `RESEND_API_URL` reste absent en production afin d’utiliser l’API HTTPS Resend par défaut; son override accepte uniquement HTTPS ou un loopback HTTP pour un fournisseur mock de QA isolé. Les liens de vérification expirent après 24 h et les liens de réinitialisation après 1 h. Les jetons sont aléatoires et seulement leur empreinte est stockée. L’oubli de mot de passe répond de façon neutre. Resend est appelé avec un timeout de 5 s et jusqu’à trois tentatives pour les erreurs transitoires; aucun destinataire ou jeton n’est journalisé.

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
