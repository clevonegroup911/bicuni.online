# Exécuteurs OaaS externes — interface (STG-006)

## État runtime actuel (honnête)

```text
11 DETERMINISTIC_LOCAL
4 ADAPTER_NOT_CONFIGURED
2 DISABLED
0 REAL_EXECUTOR externe
0 stub actif
```

## Code

| Fichier | Rôle |
| --- | --- |
| `lib/oaas/providers/types.ts` | Contrat `ExternalAiExecutor` |
| `lib/oaas/providers/external-executor.ts` | Implémentation safe-by-default |
| `lib/oaas/providers/external-executor.test.ts` | Pas de simulation ; kill switch ; redaction |

## Capacités gérées

Authentification par secret, timeouts, retries plafonnés (≤3), circuit breaker,
budgets, quotas (statut `QUOTA_EXCEEDED` réservé), journal `executionLogId`,
version modèle, coût estimé (quand transport réel), latence, validation
structurée (côté appelant), redaction, erreurs explicites, désactivation
instantanée (`OAAS_EXTERNAL_EXECUTOR_KILL_SWITCH=1` ou enabled≠1).

## Activation future (interdit dans ce lot)

1. Choix propriétaire du provider.
2. Secret staging dédié.
3. `OAAS_EXTERNAL_EXECUTOR_ENABLED=1`.
4. PR de transport réel + tests — **sans** stub de complétion.
