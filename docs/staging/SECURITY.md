# Sécurité staging

## Périmètre

Staging est un environnement **hostile-friendly** : moins d’utilisateurs, mais
mêmes classes de risques (auth, upload, paiements). Isoler ne dispense pas des
contrôles.

## Contrôles requis

| Contrôle | Exigence staging |
| --- | --- |
| Auth / RBAC | Comptes TEST uniquement ; rôles admin limités |
| MFA | Activée pour admins TEST |
| Secrets | `*_STAGING` distincts ; pas de prod |
| Stockage | Bucket privé, `public_access_prevention=enforced` |
| Upload | Antivirus si activé ; sinon `PENDING` (jamais « clean » silencieux) |
| Paiements | `sk_test_` / paiement TEST OaaS seulement |
| Webhooks | Endpoints staging ; signature vérifiée |
| Réseau | Pas d’`allUsers` sans décision ; SQL sans authorized_networks |
| Logs | Rétention limitée ; redaction secrets |
| SA | `bicuni-staging-runtime` least privilege |
| IaC guards | Tests unitaires interdisent les noms prod |

## Exécuteurs OaaS

État honnête à préserver jusqu’à décision IA :

```text
11 DETERMINISTIC_LOCAL
4 ADAPTER_NOT_CONFIGURED
2 DISABLED
0 REAL_EXECUTOR
```

Interface : `lib/oaas/providers/*` — kill switch ON par défaut, aucune
simulation de réponse modèle.

## GitHub

- 0 environment aujourd’hui — à créer avant deploy automatisé.
- Protection de `main` absente (classic) — **à corriger** avant apply staging
  (ruleset ou branch protection + required checks).

## Interdits

- Activer des API facturables (`dns`, `redis`, …) sans autorisation.
- Exposer staging publiquement sans case propriétaire.
- Utiliser des données personnelles réelles.
