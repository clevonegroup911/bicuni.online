# BICUNI — Backlog opérationnel X200 (pricing / paiement)

Mis à jour : 2026-09-18  
Branche : `ai/cursor/BIC-X200-QG-012`  
SHA de démarrage : `c071cd4dbf5f79fa07a35c77e3c17b3172135c31`

| ID | Tâche | Priorité | Responsable | Dépendances | Statut |
| --- | --- | ---: | --- | --- | --- |
| T001 | Reproduire le blocage `Redirection…` | P0 | Cursor | — | TERMINÉE |
| T002 | Identifier la cause exacte | P0 | Cursor/Codex | T001 | TERMINÉE |
| T003 | Vérifier plans / prix serveur | P0 | Codex | T002 | TERMINÉE |
| T004 | Corriger création session paiement | P0 | Codex | T003 | TERMINÉE |
| T005 | Corriger boutons et états UI `/pricing` | P0 | Cursor | T002 | TERMINÉE |
| T006 | Préserver le plan pendant login/signup | P1 | Cursor | T004–T005 | TERMINÉE |
| T007 | Sécuriser webhook paiement | P0 | Codex | T004 | TERMINÉE |
| T008 | Activer abonnement après paiement | P0 | Codex | T007 | TERMINÉE |
| T009 | Enregistrer transaction et facture | P1 | Codex | T007 | TERMINÉE |
| T010 | Annulation et portail client | P1 | Codex/Cursor | T008 | TERMINÉE |
| T011 | Paiement annulé / refusé / expiré | P1 | Cursor/Codex | T004 | TERMINÉE |
| T012 | Fournisseur non configuré sans faux succès | P0 | Codex/Cursor | T004 | TERMINÉE |
| T013 | Droits associés à chaque plan | P0 | Codex | T008 | TERMINÉE |
| T014 | Tests unitaires et d’intégration | P0 | Codex | T004–T013 | TERMINÉE |
| T015 | Tests E2E parcours commercial | P0 | Cursor | T005–T013 | TERMINÉE |
| T016 | Desktop / tablette / mobile | P1 | Cursor | T015 | TERMINÉE |
| T017 | Audit, lint, typecheck, tests, build | P0 | Codex | T014–T016 | TERMINÉE |
| T018 | Runtime de production | P0 | Codex | T017 | BLOQUÉE |
| T019 | Corriger défauts P0/P1 | P0 | Agent concerné | T018 | TERMINÉE |
| T020 | Livraison avec preuves | P1 | ChatGPT Work | T019 | TERMINÉE |
| T021 | Déblocage environnement local paiement | P0 | Cursor | T017 | TERMINÉE |

## Cause T002 (preuves)

1. Régression locale sur `CheckoutButton` : `router.replace` après 401 sans sortir de `pending` → libellé permanent « Redirection… ».
2. `POST /api/payments/checkout` sans garde `STRIPE_SECRET_KEY` ni `try/catch` → exception non maîtrisée quand Stripe est absent.
3. URL de succès `/dashboard` protégée par `requireActiveSubscriber` avant webhook → boucle vers `/pricing?required=1`.

## Plans catalogue (serveur / seed)

| Slug | Nom | priceCents | Devise |
| --- | --- | ---: | --- |
| starter | Starter | 200 | USD |
| student-premium | Étudiant Premium | 700 | USD |
| researcher | Chercheur | 2400 | USD |
| university | Université | 10000 | USD |

## Déblocage local (T021)

- PostgreSQL jetable Podman `127.0.0.1:55438` (compte `bicuni_test` uniquement).
- Parcours CLEVONE manuel testé de bout en bout (commande → preuve TEST → double approbation MFA → PAID unique → abonnement → reçu).
- Antivirus : ClamAV binaire présent ; harness HTTP local pour verdicts clean/infected/unavailable.
- GCS staging réel : BLOQUÉ (pas de `GCS_BUCKET` / credentials).
- Secrets externes encore requis pour staging réel : voir rapport final.
