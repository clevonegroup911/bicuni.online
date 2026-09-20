# Architecture staging isolée — BICUNI OaaS

Date : 2026-09-20  
Référence code : `main` @ `5cca6d0914cccb4672d5b0b4198643a01e5234cc`  
Statut : **conception uniquement** — aucune ressource créée par ce lot.

## Objectif

Fournir un environnement **physiquement isolé** pour valider OaaS avant toute
promotion. Aucune dépendance aux données, secrets, buckets ou bases de
production.

## Schéma logique

```text
                    ┌─────────────────────────────┐
  opérateurs TEST → │ Cloud Run bicuni-staging    │
  (auth / IAP)      │ europe-west1                │
                    └───────────┬─────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
 ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐
 │ Cloud SQL      │   │ GCS privé        │   │ Secret Manager │
 │ bicuni-staging │   │ bicuni-staging-  │   │ *_STAGING      │
 │ -postgres      │   │ storage-504414   │   │ (noms seuls)   │
 └────────────────┘   └──────────────────┘   └────────────────┘
          │
          └─ Redis Option A : absent / rate-limit dégradé
             Redis Option B : Memorystore bicuni-staging-redis
```

## Composants

| Composant | Cible | Isolation |
| --- | --- | --- |
| Application | Cloud Run `bicuni-staging` | Service distinct de `bicuni-online` |
| Région | `europe-west1` | Alignée prod pour latence, stack séparée |
| Base | `bicuni-staging-postgres` / DB `bicuni_staging` | **Jamais** `bicuni-postgres` |
| Stockage | `bicuni-staging-storage-504414` | **Jamais** `bicuni-storage-504414` |
| URL | `staging.bicuni.online` ou URL Run authentifiée | Pas de trafic depuis `bicuni.online` |
| Identité | SA `bicuni-staging-runtime@…` | Distincte de `bicuni-runtime@…` |
| Secrets | `*_STAGING` | Versions distinctes ; aucun secret prod |
| Paiements | Stripe TEST + `OAAS_ALLOW_TEST_PAYMENTS=1` | Aucune carte réelle |
| Email | Resend mode test / domaine staging | Aucun utilisateur réel |
| Antivirus | HTTP staging optionnel | Isolé ; fichiers restent `PENDING` si absent |
| IA externe | Interface prête, **0 REAL_EXECUTOR** | Kill switch ON par défaut |

## Règles d’isolation (non négociables)

1. Aucune connexion applicative à `bicuni-postgres`.
2. Aucune écriture sur `bicuni-storage-504414`.
3. Aucun secret de production monté sur `bicuni-staging`.
4. Aucun compte utilisateur réel ; seed `TEST` uniquement.
5. Aucun `allUsers` sans décision explicite du propriétaire
   (`allow_unauthenticated=false` par défaut).
6. Aucune copie brute de la production (pas de dump/restore prod→staging).

## Inventaire différentiel (STG-001)

| Ressource | Statut | Note |
| --- | --- | --- |
| Projet `bicuni-504414` | EXISTANT | Actif |
| Cloud Run `bicuni-online` | EXISTANT | **Ne pas toucher** |
| Cloud Run `bicuni-staging` | ABSENT → À CRÉER | Après autorisation |
| Cloud SQL `bicuni-postgres` | EXISTANT | **Ne pas toucher** |
| Cloud SQL `bicuni-staging-postgres` | ABSENT → À CRÉER | Isolé |
| Bucket `bicuni-storage-504414` | EXISTANT | **Ne pas toucher** |
| Bucket `bicuni-staging-storage-504414` | ABSENT → À CRÉER | Privé |
| SA `bicuni-runtime` / `bicuni-build` | EXISTANT | Ne pas réutiliser pour staging |
| SA `bicuni-staging-runtime` | ABSENT → À CRÉER | Least privilege |
| Secrets `AUTH_SECRET`, `DATABASE_URL` | EXISTANT | Noms seuls ; **prod** |
| Secrets `*_STAGING` | ABSENT → À CRÉER | Noms distincts |
| Artifact Registry `bicuni` (ew1) | EXISTANT | Réutiliser avec tags `staging` |
| Cloud DNS API | ABSENT | NON ACCESSIBLE / désactivée — ne pas activer ici |
| Memorystore Redis | ABSENT | API désactivée — Option B seulement |
| GitHub Environments | ABSENT | 0 environment |
| GitHub Actions secrets/vars | ABSENT | Aucun secret repo listé |
| Workflow `BICUNI CI` | EXISTANT | CI seule, pas de deploy |
| Protection `main` (classic) | ABSENT | À CORRIGER (recommandé avant apply) |

## Choix GCS canonique

- **Canonique :** `GCS_BUCKET`
- **Alias legacy :** `GCS_BUCKET_NAME` (lu en repli dans `lib/storage/index.ts`)
- **Suppression prévue de l’alias :** 2026-12-31
- Staging injecte **uniquement** `GCS_BUCKET=bicuni-staging-storage-504414`

## IaC

Voir `infra/staging/`. Aucun `terraform apply` dans ce lot.
