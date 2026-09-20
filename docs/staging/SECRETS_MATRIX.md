# Matrice des secrets — staging (noms uniquement)

Aucune **valeur** de secret n’est stockée dans ce dépôt.

## Décision GCS

| Décision | Détail |
| --- | --- |
| Nom canonique | `GCS_BUCKET` |
| Alias legacy | `GCS_BUCKET_NAME` (repli dans `lib/storage/index.ts`) |
| Staging | injecter **uniquement** `GCS_BUCKET` |
| Production | ne pas modifier dans ce lot |
| Fin d’alias | **2026-12-31** (après migration Cloud Run prod → `GCS_BUCKET`) |

## Matrice

Légende obligation : R = obligatoire staging web, C = conditionnel, O = optionnel.

| Nom | Obligation | Producteur | Consommateur | Env | Rotation | Validation | Si absent | Sensibilité | Emplacement cible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PUBLIC_APP_URL` | R | Ops / Terraform env | emails, Stripe return, CSP | staging | rare | URL HTTPS | erreurs liens / CSP | basse (URL) | Cloud Run env |
| `DATABASE_URL` | R | Cloud SQL + Secret Manager version | Prisma | staging | après rotate user SQL | Prisma connect | boot KO / ready fail | **critique** | SM `DATABASE_URL_STAGING` |
| `AUTH_SECRET` | R | Ops (`openssl rand`) | Auth.js, TOTP CLEVONE | staging | 90j | longueur ≥ 32 | auth KO | **critique** | SM `AUTH_SECRET_STAGING` |
| `AUTH_URL` | R | Ops | Auth.js | staging | rare | HTTPS | callbacks cassés | basse | Cloud Run env |
| `GCS_BUCKET` | C (docs privés) | Terraform bucket name | `lib/storage` | staging | rare | bucket existe + IAM | upload privé KO | basse (nom) | Cloud Run env |
| `GCS_BUCKET_NAME` | O legacy | — | repli storage | staging | — | — | ignoré si `GCS_BUCKET` | basse | **ne pas poser en staging** |
| `GOOGLE_CLOUD_PROJECT` | C | Terraform | GCS SDK | staging | rare | = `bicuni-504414` | storage KO | basse | Cloud Run env |
| `ANTIVIRUS_SCANNER_URL` | C | Ops scanner staging | ingestion fichiers | staging | rare | HTTPS/loopback | fichiers restent `PENDING` | basse | Cloud Run env |
| `ANTIVIRUS_SCANNER_AUTHORIZATION` | C | Ops | client scanner | staging | 90j | header valide | scanner indisponible | **haute** | SM `…_STAGING` |
| `RESEND_API_KEY` | C emails | Resend TEST | `lib/email` | staging | 90j | API test | pas d’email (OK si non testé) | **haute** | SM `RESEND_API_KEY_STAGING` |
| `EMAIL_FROM` | C | Ops | email | staging | rare | domaine vérifié test | envoi KO | basse | Cloud Run env |
| `STRIPE_SECRET_KEY` | C | Stripe TEST (`sk_test_…`) | checkout | staging | 90j | préfixe `sk_test_` | Stripe ADAPTER off | **critique** | SM `STRIPE_SECRET_KEY_STAGING` |
| `STRIPE_WEBHOOK_SECRET` | C | Stripe TEST webhook | webhook | staging | 90j | signature | webhooks rejetés | **critique** | SM `STRIPE_WEBHOOK_SECRET_STAGING` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | C | Stripe TEST (`pk_test_…`) | build/UI | staging | 90j | préfixe `pk_test_` | checkout UI KO | basse (public test) | Cloud Run / build arg |
| `REDIS_URL` | O Option A / R Option B | Memorystore ou équivalent | rate-limit | staging | rare | ping | rate-limit dégradé | **haute** | SM `REDIS_URL_STAGING` |
| `REDIS_KEY_PREFIX` | R si Redis | Terraform | rate-limit | staging | rare | `bicuni-staging` | collisions possibles | basse | Cloud Run env |
| `OAAS_ALLOW_TEST_PAYMENTS` | R staging | Terraform | paiement TEST OaaS | staging | — | `1` | paiement TEST refusé | basse | Cloud Run env |
| `SEARCH_SYNC_SECRET` | C | Ops | `/api/search/sync` | staging | 90j | compare constant-time | sync refusé | **haute** | SM `…_STAGING` |
| `OAAS_EXTERNAL_EXECUTOR_SECRET` | O | Owner si IA | provider externe | staging | 90j | présent + kill switch | `ADAPTER_NOT_CONFIGURED` | **critique** | SM `…_STAGING` |
| `OAAS_EXTERNAL_EXECUTOR_ENABLED` | O | Owner | kill switch inverse | staging | — | `1` pour activer | DISABLED | basse | Cloud Run env |
| `OAAS_EXTERNAL_PROVIDER` | O | Owner | `openai`/`anthropic`/`gemini_vertex` | staging | — | enum | none | basse | Cloud Run env |
| `TRUSTED_PROXY_STRATEGY` | R | Terraform | identité IP | staging | — | `cloud-run` | défaut sûr | basse | Cloud Run env |
| `MEILISEARCH_*` | O | Ops si recherche | search worker | staging | 90j | host privé | recherche limitée | haute (clés) | SM / env |
| `CLEVONE_*` | O | Ops | paiement manuel TEST | staging | — | — | adaptateur manuel | variable | env (pas de prod) |
| `SUPER_ADMIN_*` | C job ponctuel | Ops | `admin:init` | staging | one-shot | script | pas d’admin | **critique** | injection éphémère Job |

## Secrets GitHub

État inventaire 2026-09-20 : **aucun** secret / variable Actions au niveau repo.
Environnements GitHub : **0**.  
À créer plus tard (hors ce lot) si un workflow de deploy staging est autorisé :
noms uniquement, jamais les valeurs dans git.

## Interdits

- Monter `DATABASE_URL` / `AUTH_SECRET` **production** sur staging.
- Utiliser `sk_live_` / `pk_live_` en staging.
- Committer `.tfvars` avec des secrets.
