# Audit npm — Sprint 002

Audit exécuté le 16 août 2026 avec `npm audit --json` après `npm ci`, sans `npm audit fix` ni mise à jour forcée.

## Résultat

- 11 paquets signalés : 6 élevés, 5 modérés, 0 critique.
- Aucune vulnérabilité élevée n’est exploitable dans le runtime BICUNI actuel selon les chemins de code inspectés.
- Aucune vulnérabilité P0. La montée de version majeure de Next.js doit être traitée séparément et testée, pas pendant cette intégration.

## Vulnérabilités élevées

| Paquet installé | Chemin | Avis / type | Usage réel et exposition | Correctif annoncé | Priorité |
|---|---|---|---|---|---|
| `brace-expansion@5.0.8`, `1.1.17` | `eslint-config-next > @typescript-eslint > minimatch` et `eslint > minimatch` | `GHSA-rgw5-rvv9-x895`, DoS par expansion non bornée | Développement/CI seulement. BICUNI ne transmet aucune entrée HTTP à ESLint ou minimatch. Non exploitable dans le serveur de production. | Disponible transitivement; mise à jour du lockfile à planifier sans `--force`. | P2 |
| `js-yaml@4.3.0` | `eslint > @eslint/eslintrc` | `GHSA-5p4m-2wfm-xmqj`, consommation CPU quadratique | Développement/CI seulement, sur configuration versionnée et de confiance. Aucun YAML utilisateur n’est analysé au runtime. | Disponible transitivement. | P2 |
| `nanoid@3.3.16` | `next > postcss` et `postcss` | `GHSA-2v37-7h3g-55p8`, boucle possible pour une taille personnalisée nulle | Build CSS seulement. Aucun générateur Nano ID personnalisé ni taille contrôlée par un utilisateur. Non exploitable au runtime actuel. | Disponible transitivement. | P2 |
| `postcss@8.4.31` | `next > postcss` | `GHSA-6g55-p6wh-862q`, `GHSA-fxqj-rqcc-2cmp`, `GHSA-r28c-9q8g-f849`, lecture de source maps; `GHSA-qx2v-qp2m-jg93`, sortie CSS non échappée | Build uniquement sur les CSS suivis par Git. Aucun CSS ni `sourceMappingURL` fourni par un utilisateur n’est traité en production. Risque CI si un contributeur non fiable peut modifier les sources. | `npm audit` propose Next `16.3.1`, changement majeur. | P1 |
| `sharp@0.34.5` | dépendance optionnelle de `next` | `GHSA-f88m-g3jw-g9cj`, vulnérabilités héritées de libvips | Aucun import `next/image`, `ImageResponse` ou appel direct à Sharp dans BICUNI. Les avatars utilisent une balise `img`; le stockage produit un SVG sans Sharp. Non exploitable dans le runtime actuel, à réévaluer avant toute optimisation d’image. | `npm audit` propose Next `16.3.1`, changement majeur. | P1 |
| `next@15.5.22` | dépendance directe | Sévérité héritée des chemins `postcss` et `sharp` ci-dessus | Next est exécuté en production, mais les deux chemins vulnérables signalés ne sont pas atteignables avec les fonctionnalités actuelles. Ce résultat ne justifie pas une mise à jour majeure non préparée pendant l’intégration. | Next `16.3.1`, changement majeur et potentiellement cassant. | P1 |

## Vulnérabilités modérées

| Paquet installé | Chemin | Avis / type | Usage réel et exposition | Correctif annoncé | Priorité |
|---|---|---|---|---|---|
| `uuid@9.0.1` | `@google-cloud/storage > gaxios/teeny-request` | `GHSA-w5hq-g745-h8pq`, contrôle de bornes pour v3/v5/v6 avec buffer fourni | Runtime GCS, mais BICUNI appelle seulement les API de signature, métadonnées et objets; aucun buffer UUID ni appel UUID utilisateur. | `npm audit` rattache le correctif à un changement majeur de `@google-cloud/storage`. | P2 |
| `gaxios@6.7.1` | `@google-cloud/storage` | Sévérité héritée de `uuid` | Runtime GCS; chemin UUID vulnérable non appelé directement par BICUNI. | Correctif transitif disponible. | P2 |
| `teeny-request@9.0.0` | `@google-cloud/storage` et `retry-request` | Sévérité héritée de `uuid` | Runtime GCS sur des requêtes serveur configurées, pas sur un buffer UUID client. | `npm audit` propose un changement majeur de `@google-cloud/storage`. | P2 |
| `retry-request@7.0.2` | `@google-cloud/storage` | Sévérité héritée de `teeny-request` | Runtime GCS; pas de vulnérabilité directe supplémentaire dans le rapport. | Changement majeur proposé. | P2 |
| `@google-cloud/storage@7.21.0` | dépendance directe | Sévérité héritée de `retry-request` et `teeny-request` | Runtime pour URLs signées, stat, suppression et miniature SVG privée. Les chemins UUID signalés ne sont pas contrôlés par l’utilisateur. | La proposition automatique `5.18.3` est un downgrade majeur et n’est pas appliquée. | P2 |

## Décision

Les six alertes élevées ne constituent pas six vulnérabilités runtime exploitables : trois sont limitées aux outils de build/lint, deux chemins Next ne sont pas utilisés par l’application actuelle, et l’entrée Next agrège ces dépendances. L’intégration n’est donc pas bloquée par l’audit, mais les éléments P1 exigent une tâche dédiée de montée de version et une nouvelle validation complète avant production.
