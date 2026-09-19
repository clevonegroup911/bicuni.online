# T060 — Rapport BICUNI OaaS (checkpoint feat/bicuni-oaas-core)

```text
MODÈLE OaaS :            OutcomeMission + contrat / plan / tâches / preuves / livrables
MISSION VERTICALE :      Pack Recherche académique vérifiée (academic-research)
ORCHESTRATEUR :          lib/oaas/orchestrator.ts (graphe, parallèle, checkpoints, reprise)
AGENTS :                 17 agents (registre + seed OutcomeAgent)
OUTCOME CONTRACT :       OutcomeContract (émission, accept/refuse/amend, historique version)
PAIEMENT PAR MISSION :   createOutcomeCheckout → PaymentIntent.outcomeMissionId → unlock PLANNED
LIVRABLES :              OutcomeDeliverable (problématique, sources, biblio, synthèse, ledger…)
PREUVES :                OutcomeEvidence (invented=false obligatoire) + Quality Gate
INTÉGRITÉ ACADÉMIQUE :   interdits agents + déclaration IA + distinction fait/inférence/proposition
TESTS :                  suite Vitest (OaaS 17 + régression) — exécuter npm test
BUILD :                  réussi (routes /outcomes, /dashboard/missions*)
VULNÉRABILITÉS :         0 critique / 0 élevée (1 moderate qs transitive)
SHA :                    voir HEAD branche feat/bicuni-oaas-core (ancêtre fondation 910f5b1)
PUSH :                   non
PR :                     non
MERGE :                  non
DÉPLOIEMENT :            non
```

## Checkpoint T051

- Fondation paiement `910f5b1f5b709c2df195476e63ef6699612c71bc` : ancêtre de HEAD
- Migrations : 9 (ajout `20260919140000_oaas_core`)
- Branche : `feat/bicuni-oaas-core`
- Pas de merge / déploiement

## Parcours livré

1. Décrire résultat (`/outcomes` → `/dashboard/missions/new`)
2. Qualification / devis / contrat
3. Paiement acompte CLEVONE (sans abonnement auto)
4. Plan + agents + revue humaine
5. Quality Gate → livrables + preuves
6. Acceptation / révision

## Restes

- E2E Playwright multi-viewport (1280/834/390) à ajouter sur harness DB
- Stripe one-shot mission (aujourd’hui CLEVONE outcome checkout)
- Pages dédiées Plans d’exécution / Approbations / Preuves (données déjà sur détail mission)
- Validation commerciale des tarifs (catalogue = indicatif uniquement)
