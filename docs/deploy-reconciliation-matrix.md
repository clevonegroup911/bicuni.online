# Matrice de réconciliation BIC-DEPLOY-READINESS-005

Sources comparées :

- Cursor local `ai/cursor/BIC-DEPLOY-READINESS-003` (`b31a6ee`), utilisé car la
  branche `origin/ai/cursor/BIC-DEPLOY-READINESS-003` n'existe pas sur le remote;
- Codex local `codex/BIC-DEPLOY-GOVERNANCE-003` (`a46025a`);
- base commune `origin/main` (`2192d2d`).

## Fichiers communs

| Fichier | Classe | Décision démontrable |
| --- | --- | --- |
| `.env.example` | modification commune compatible | Cursor retenu : Redis fail-closed, stratégie proxy et scanner; documentation Codex alignée |
| `Dockerfile` | conflit fonctionnel | combinaison : télémétrie Cursor + digest, standalone et images séparées Codex |
| `app/api/documents/[id]/versions/route.ts` | conflit fonctionnel | Cursor : chaque version reste `PENDING` jusqu'au scan |
| `app/api/documents/upload/route.ts` | conflit fonctionnel | Cursor : digest serveur et verdict antivirus; aucune confiance dans une métadonnée client |
| `lib/auth/rate-limit.test.ts` | test propre aux deux branches | Cursor, superset : 503 Redis, proxy Cloud Run, loopback et spoofing |
| `lib/auth/rate-limit.ts` | conflit fonctionnel | Cursor : exception explicite puis 503, au lieu d'un faux résultat de limitation |
| `lib/health/checks.test.ts` | doublon compatible | Cursor, superset : PostgreSQL, Redis, timeout et rapport sans secret |
| `lib/health/checks.ts` | doublon compatible | Cursor : lazy-load Prisma et readiness PostgreSQL + Redis |
| `lib/security/headers.test.ts` | test propre aux deux branches | Cursor, superset : nonce CSP, absence de script unsafe-inline et HSTS HTTPS |
| `lib/security/headers.ts` | conflit fonctionnel | Cursor : CSP par requête avec nonce et HSTS seulement sur HTTPS |
| `lib/storage/index.ts` | conflit fonctionnel | Cursor : lecture de l'objet et recalcul SHA-256 côté serveur |
| `next-env.d.ts` | modification commune compatible | version production stable identique |
| `next.config.ts` | modification commune compatible | `useTypeScriptCli: false` Cursor + `output: standalone` Codex |

## Fichiers uniquement Cursor

Tous sont retenus. Ils portent le scan antivirus, l'interdiction de publication
des fichiers non `CLEAN`, les protections auth et les tests associés.

| Fichier | Classe |
| --- | --- |
| `app/(site)/documents/[id]/page.tsx` | uniquement Cursor |
| `app/admin/documents/[id]/page.tsx` | uniquement Cursor |
| `app/api/auth/forgot-password/route.ts` | uniquement Cursor |
| `app/api/auth/register/route.ts` | uniquement Cursor |
| `app/api/auth/resend-verification/route.ts` | uniquement Cursor |
| `app/api/auth/reset-password/route.ts` | uniquement Cursor |
| `app/api/documents/[id]/route.ts` | uniquement Cursor |
| `app/api/documents/files/[fileId]/route.ts` | uniquement Cursor |
| `app/api/documents/files/[fileId]/route.test.ts` | test uniquement Cursor |
| `app/health/live/route.ts` | uniquement Cursor |
| `app/health/live/route.test.ts` | test uniquement Cursor |
| `app/health/ready/route.ts` | uniquement Cursor |
| `app/health/ready/route.test.ts` | test uniquement Cursor |
| `auth.ts` | uniquement Cursor |
| `docs/production-readiness.md` | uniquement Cursor |
| `lib/admin/document-admin-service.ts` | uniquement Cursor |
| `lib/admin/document-admin-service.isolation.test.ts` | test uniquement Cursor |
| `lib/documents/antivirus-scanner.ts` | uniquement Cursor |
| `lib/documents/antivirus-scanner.test.ts` | test uniquement Cursor |
| `lib/documents/document-service.ts` | uniquement Cursor |
| `lib/documents/file-ingestion.ts` | uniquement Cursor |
| `lib/documents/file-ingestion.test.ts` | test uniquement Cursor |
| `lib/documents/file-scan.ts` | uniquement Cursor |
| `lib/documents/file-scan.test.ts` | test uniquement Cursor |
| `lib/documents/review-service.ts` | uniquement Cursor |
| `lib/documents/review-service.test.ts` | test uniquement Cursor |
| `lib/health/http.ts` | uniquement Cursor |
| `middleware.test.ts` | test uniquement Cursor |
| `package.json` | uniquement Cursor |
| `prisma/migrations/20260819120000_document_file_scan_status/migration.sql` | uniquement Cursor |
| `prisma/schema.prisma` | uniquement Cursor |
| `proxy.ts` | uniquement Cursor |
| `tsconfig.json` | uniquement Cursor |

## Fichiers uniquement Codex

| Fichier | Classe | Décision |
| --- | --- | --- |
| `.github/workflows/bicuni-ci.yml` | uniquement Codex | retenu |
| `app/api/health/live/route.ts` | uniquement Codex | retenu comme alias du healthcheck Cursor |
| `app/api/health/live/route.test.ts` | test uniquement Codex | retenu et adapté au payload Cursor |
| `app/api/health/ready/route.ts` | uniquement Codex | retenu comme alias du healthcheck Cursor |
| `cloudbuild.yaml` | uniquement Codex | retenu, deux images sans déploiement |
| `components/documents/metadata-form.tsx` | uniquement Codex | non retenu : l'en-tête de checksum client ne prouve pas l'intégrité |
| `components/documents/version-upload.tsx` | uniquement Codex | non retenu pour la même raison |
| `docs/cloud-run-environment-matrix.md` | uniquement Codex | retenu et complété avec le scanner Cursor |
| `docs/cloud-run-production-deployment.md` | uniquement Codex | retenu et aligné sur les états de scan Cursor |
| `lib/admin/context.ts` | uniquement Codex | retenu : même identité proxy que le rate limiter |
| `lib/storage/index.test.ts` | test uniquement Codex | retenu et adapté au digest serveur choisi |

## Ajout de réconciliation

- `app/api/health/ready/route.test.ts` vérifie le contrat 503 de l'alias API.
- Aucun des 357 tests Cursor n'est supprimé; le total final est mesuré par la
  validation propre ci-dessous, et non déduit de cette matrice.
- Les assertions Codex devenues invalides après choix du digest serveur sont
  remplacées par des assertions plus fortes sur les octets réellement relus.
