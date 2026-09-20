# OaaS — modèle opérationnel et preuves

## Statut

Lot local `feat/bicuni-oaas-core` : Outcome-as-a-Service opérationnel **en local**
avec paiement TEST, tranche déterministe « Recherche académique vérifiée », Quality Gate
et Evidence Ledger. Staging / production non activés dans ce lot.

## Parcours nominal

1. Catalogue `/outcomes` → CTA « Décrire le résultat »
2. Assistant `/dashboard/missions/new`
3. Qualification → devis serveur → contrat figé → acceptation
4. Paiement TEST (`pay-test`) ou CLEVONE manuel
5. Plan → exécution agents → revue humaine → Quality Gate → livraison
6. Acceptation ou révision (limite contractuelle)
7. Facture + reçu liés à la mission

## Agents (17)

| Kind | Agents |
| --- | --- |
| `DETERMINISTIC_LOCAL` | research-intake, document-ingestion, source-discovery, source-verification, quality-control, classification, bibliography, citation, academic-writing, security-privacy, delivery |
| `ADAPTER_NOT_CONFIGURED` | ocr, translation, pid, archive |
| `DISABLED` | metadata, editorial |
| `REAL_EXECUTOR` | (aucun dans ce lot) |
| `STUB_FORBIDDEN` | (aucun enregistré comme actif) |

Règle : `available=true` uniquement pour `DETERMINISTIC_LOCAL` / `REAL_EXECUTOR`.

`STRIPE` one-shot OaaS = `ADAPTER_NOT_CONFIGURED`.

## Alignement GCS

Cloud Run expose parfois `GCS_BUCKET_NAME`. L’application lit `GCS_BUCKET`.
Correction documentée dans `docs/cloud-run-environment-matrix.md` — **ne pas
modifier la production** dans ce lot. Staging devra injecter `GCS_BUCKET` (ou un
alias explicite).

## Données TEST

Seed `npm run db:seed:oaas` : packs, 17 agents, utilisateurs `*.example.test`,
mission `OM-TEST-SEED001`. Marquage `[TEST]` / `dataset: TEST`.
