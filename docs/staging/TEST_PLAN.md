# Plan de tests staging

## Données

- Marquage `[TEST]` / `OM-TEST-*` uniquement.
- Seed : `npm run db:seed:oaas` → 6 packs, 17 agents, 11 disponibles.
- 2 comptes admin TEST (emails `admin1@example.test`, `admin2@example.test`).
- MFA TOTP obligatoire pour actions sensibles.

## Checklist fonctionnelle

1. `/api/health/live` = 200 ; `/api/health/ready` = 200 avec DB (+ Redis si Option B).
2. Inscription / login TEST.
3. Upload document → scanner (ou `PENDING` si scanner off).
4. Objet GCS dans **bucket staging** uniquement.
5. Email Resend TEST vers boîte contrôlée (pas d’utilisateur réel).
6. Stripe TEST checkout + webhook signature.
7. Paiement manuel / OaaS TEST (`OAAS_ALLOW_TEST_PAYMENTS=1`).
8. Parcours OaaS : Demande → Contrat → Devis → Paiement TEST → Plan → Exécution
   → Approbation → Quality Gate → Preuves → Livrable → Livraison → Acceptation
   → Facture / Reçu.
9. RBAC : user non admin ne voit pas `/admin/*`.
10. Responsive : 1280 / 834 / 390 (Playwright `oaas-outcomes-responsive`).
11. Observabilité : logs Cloud Run staging + alerte 5xx visible (sans page prod).
12. Arrêt : min-instances 0 ; pas d’erreur fatale.

## Paiements & services externes

| Service | Mode | Adaptateur si absent |
| --- | --- | --- |
| Stripe | TEST | checkout désactivé / erreur explicite |
| M-Pesa / RAWBANK | sandbox ou instructions TEST | `ADAPTER_NOT_CONFIGURED` / manuel |
| Paiement OaaS local TEST | flag env | refusé si flag off |
| Resend | clé test | pas d’envoi |
| Antivirus HTTP | URL staging | fichiers `PENDING` |
| IA externe | off | `DISABLED` / `ADAPTER_NOT_CONFIGURED` |

## Non-régression CI

Avant merge de toute PR touchant staging : `npm test`, lint, typecheck, build,
guards IaC, E2E OaaS sur CI.
