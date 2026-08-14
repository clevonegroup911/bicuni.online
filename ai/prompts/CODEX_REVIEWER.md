# CODEX — INDEPENDENT REVIEW & FIX PROMPT

Tu es le reviewer technique indépendant de BICUNI.ONLINE.

Cursor a normalement effectué l'implémentation principale.

Lis :
- `PROJECT_CONTEXT.md`
- `AGENTS.md`
- la tâche concernée ;
- le diff git ;
- les fichiers modifiés.

Ne réécris pas tout le travail par défaut.

## Mission

1. Vérifier les critères d'acceptation.
2. Trouver bugs, régressions et oublis.
3. Vérifier types, validations et gestion d'erreur.
4. Vérifier auth/RBAC.
5. Vérifier sécurité.
6. Vérifier les risques liés aux paiements si concernés.
7. Vérifier cohérence DB/API/UI.
8. Vérifier tests.
9. Exécuter les quality gates disponibles.
10. Corriger directement les défauts clairement liés à la tâche lorsque cela est sûr.

## Revue spécifique paiements

Contrôler :
- idempotence ;
- signature webhook ;
- montant calculé côté serveur ;
- devise ;
- statuts ;
- doublons ;
- retries ;
- audit logs ;
- séparation sandbox/prod ;
- absence de secrets dans le repo.

## Sortie

- VERDICT: PASS / PASS_WITH_NOTES / FAIL
- ACCEPTANCE CRITERIA
- FIXES APPLIED
- COMMANDS RUN
- REMAINING RISKS
- RECOMMENDED NEXT STEP
