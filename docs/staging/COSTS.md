# Coûts staging — estimations (non garanties)

Date des tarifs consultés : **2026-09-20**  
Sources :

- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
- [Memorystore for Redis pricing](https://cloud.google.com/memorystore/docs/redis/pricing)
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing)

Toutes les figures sont des **ordres de grandeur USD / mois**, hors taxes,
hors egress exceptionnel, hors remises contrat. Ce ne sont **pas** des prix
garantis.

Hypothèses communes : région `europe-west1`, projet `bicuni-504414`, usage
QA intermittent (quelques heures / jour), pas de trafic public réel.

## Option A — Staging économique (recommandée pour la 1ʳᵉ autorisation)

| Poste | Dimensionnement | Min | Probable | Max contrôlé |
| --- | --- | --- | --- | --- |
| Cloud Run | min=0, 1 vCPU / 1 GiB, <50k req | ≈ 0–2 | 3–8 | 15 |
| Cloud SQL | `db-f1-micro`, 20 GiB SSD, zonal, backups 7j | ≈ 10 | 12–18 | 25 |
| GCS | <20 GiB, nearline après 90j | ≈ 0.5 | 1–2 | 5 |
| Redis | **désactivé** (rate-limit dégradé OK hors prod) | 0 | 0 | 0 |
| Antivirus HTTP | allumé seulement pendant tests | 0 | 1–3 | 8 |
| Logging | rétention 30j | ≈ 0–1 | 1–2 | 5 |
| Secret Manager | ~10 secrets, peu d’accès | ≈ 0 | <1 | 2 |
| **Total** | | **≈ 12** | **≈ 20–35** | **≈ 60** |

- **Coût à l’arrêt (instances stoppées, SQL toujours allumé) :** Cloud SQL
  domine (~10–18 USD). Arrêt SQL = suppression contrôlée (voir ROLLBACK).
- **Facturation à l’usage :** Cloud Run CPU/RAM/req, GCS ops, logs ingest.
- **Suppression :** `terraform destroy` **uniquement** après autorisation +
  retrait de `prevent_destroy` / `deletion_protection` documenté.
- **Impact fonctionnel :** cold start ; Redis absent ⇒ rate-limit local/mémoire
  moins robuste multi-instance ; antivirus optionnel.
- **Risques :** sous-dimensionnement SQL partagé ; oublier d’éteindre = facture
  SQL continue.
- **Limites :** non représentatif de la charge prod.

Budget alerte Terraform proposé : **80 USD / mois**.

## Option B — Staging représentatif

| Poste | Dimensionnement | Min | Probable | Max contrôlé |
| --- | --- | --- | --- | --- |
| Cloud Run | min≥1, 2 GiB, always-on léger | ≈ 25 | 40–70 | 120 |
| Cloud SQL | custom 1–2 vCPU / 4–8 GiB, 50–100 GiB | ≈ 50 | 70–120 | 180 |
| Memorystore Redis Basic 1 GiB | ~0.049 USD/GiB-h | ≈ 30 | 35–40 | 50 |
| GCS + logging renforcés | | ≈ 5 | 10–20 | 40 |
| Antivirus + observabilité | | ≈ 5 | 10–25 | 40 |
| **Total** | | **≈ 115** | **≈ 165–275** | **≈ 430** |

- **Coût à l’arrêt :** SQL + Redis + min instances restent élevés sauf destroy.
- **Impact :** plus fidèle à la prod ; meilleure dispo pour démos internes.
- **Risques :** dérive de coût ; activation API Redis (actuellement **désactivée**
  sur le projet — activation = décision propriétaire séparée).
- **Limites :** toujours sans données prod ; ne remplace pas un load test prod.

## Méthode de suppression (les deux options)

1. Snapshot / export SQL staging.
2. Désactiver `deletion_protection` + `lifecycle.prevent_destroy` via PR dédiée.
3. `terraform destroy` sur le workspace staging uniquement.
4. Vérifier qu’aucun nom production n’apparaît dans le plan destroy.
5. Confirmer facturation J+1.

## Décision propriétaire attendue

Choisir **A** ou **B** (ou un hybride documenté) avant tout `apply`.
