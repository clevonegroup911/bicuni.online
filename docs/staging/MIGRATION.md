# Migrations staging

## Principe

Les 9 migrations Prisma du dépôt s’appliquent sur une **base vide**
`bicuni_staging` de l’instance `bicuni-staging-postgres` uniquement.

```text
npx prisma migrate deploy
```

avec `DATABASE_URL` = secret staging (Cloud SQL Auth Proxy / socket Cloud Run).

## Séquence

1. Vérifier `prisma migrate status` → base staging vide ou cohérente.
2. `prisma migrate deploy` (9 fichiers sous `prisma/migrations`).
3. `npm run db:seed:oaas` → packs=6 agents=17 (données `[TEST]`).
4. Créer 2 administrateurs TEST via `npm run admin:init` (emails `@example.test`).
5. Activer MFA TOTP sur les comptes admin TEST (`CLEVONE_REQUIRE_MFA=1` recommandé).
6. Ne **jamais** exécuter ces commandes avec le secret prod.

## Sauvegarde / restauration

- Backups Cloud SQL activés (7 jours, PITR) dans l’IaC staging.
- Avant migration risquée : `gcloud sql backups create --instance=bicuni-staging-postgres`.
- Restauration : clone staging → nouvelle instance staging ; **pas** de restore
  vers `bicuni-postgres`.

## Rollback schéma

Voir `ROLLBACK.md`. Prisma n’a pas de down automatique : restaurer un backup
staging ou déployer une migration corrective via nouvelle PR.
