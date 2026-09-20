# Déploiement staging — runbook (après autorisation)

**Ce document ne déploie rien.** Il décrit la procédure future.

## Prérequis

1. Autorisation propriétaire signée (`OWNER_APPROVAL.md`).
2. Choix Option A ou B (`COSTS.md`).
3. PR IaC fusionnée.
4. Secrets staging créés (noms `*_STAGING`) — valeurs hors git.
5. Image construite et poussée vers Artifact Registry `bicuni` avec tag/digest
   `staging` (jamais écraser un digest prod).

## Ordre recommandé

1. `terraform init` (backend GCS staging dédié — **pas** un bucket prod).
2. `terraform plan -var-file=…` — vérifier absence de `bicuni-online`,
   `bicuni-postgres`, `bicuni-storage-504414`.
3. `terraform apply` (**seulement** si autorisé).
4. Renseigner versions Secret Manager (DATABASE_URL staging, AUTH_SECRET, …).
5. Déployer révision Cloud Run `bicuni-staging` (digest immuable).
6. Migrations : voir `MIGRATION.md` (SQL staging uniquement).
7. Seed OaaS TEST + 2 admins TEST : voir `TEST_PLAN.md`.
8. Smoke : health, auth, upload, paiement TEST, mission OaaS.
9. Si DNS `staging.bicuni.online` : enregistrement **nouveau** seulement
   (API DNS actuellement désactivée — activation = décision séparée).

## Callbacks prévus (non activés)

| Service | URL prévue | Activation |
| --- | --- | --- |
| Stripe TEST webhook | `https://staging.bicuni.online/api/payments/webhook` | Après apply + clé test |
| Auth.js | `https://staging.bicuni.online/api/auth/*` | Avec `AUTH_URL` |
| OaaS paiement TEST | routes dashboard missions | `OAAS_ALLOW_TEST_PAYMENTS=1` |
| Resend | webhooks fournisseur optionnels | domaine test seulement |

## Accès

- Défaut : **pas** `allUsers`. Accès via comptes TEST + éventuellement IAP /
  `roles/run.invoker` sur groupe ops.
- `allow_unauthenticated=true` exige une case cochée dans l’autorisation.

## Interdits

- `gcloud run deploy bicuni-online …`
- `prisma migrate deploy` vers `bicuni-postgres`
- Copier les secrets prod
- Pointer `GCS_BUCKET` vers `bicuni-storage-504414`
