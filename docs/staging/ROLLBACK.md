# Rollback & arrêt staging

## Objectifs

- Revenir à un état sûr sans toucher la production.
- Pouvoir **arrêter** ou **supprimer** le staging pour couper les coûts.

## Rollback applicatif (révision Cloud Run)

1. Identifier la révision saine : `gcloud run revisions list --service=bicuni-staging`.
2. Router 100 % du trafic vers cette révision.
3. Ne jamais router staging vers le service `bicuni-online`.

## Rollback données

1. Restaurer un backup Cloud SQL **staging**.
2. Rejouer seed TEST si nécessaire.
3. Interdit : restore d’un dump production.

## Arrêt économique (Option A)

1. Mettre `cloud_run_min_instances=0` (déjà défaut).
2. Stopper antivirus / jobs annexes.
3. Optionnel : arrêter l’instance SQL staging (indisponibilité totale).
4. Conserver secrets et bucket si reprise prévue.

## Suppression complète

1. Nouvelle autorisation propriétaire « destroy staging ».
2. PR retirant `lifecycle.prevent_destroy` et `deletion_protection`.
3. `terraform plan` destroy — vérifier cibles = noms staging uniquement.
4. `terraform destroy`.
5. Purger images Artifact Registry taguées `staging` si besoin.
6. Confirmer facturation.

## Incident : fuite vers prod

Si une config pointe par erreur vers prod :

1. Couper immédiatement la révision staging (trafic 0 / delete revision).
2. Révoquer les credentials fautifs.
3. Auditer IAM SA staging.
4. **Ne pas** « corriger » en écrivant sur prod depuis staging.
