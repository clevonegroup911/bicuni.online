# npm audit — staging readiness (2026-09-20)

## Avant correctif

| Paquet | Sévérité | Chemin | Prod/Dev | Correctif |
| --- | --- | --- | --- | --- |
| `qs` | moderate | `stripe@17.7.0` → `qs@6.15.3` | **prod** (stripe) | `qs@6.16.0` via `overrides` (semver mineur) |
| `@vitest/mocker` | moderate | `vitest` → `@vitest/mocker` | **dev** | nécessite `vitest@5` (majeur) |
| `vitest` | moderate | root `vitest@3.2.7` | **dev** | idem |

## Décisions

1. **`qs` :** override `6.16.0` appliqué et testé (`npm audit` + suite).
2. **`vitest` / `@vitest/mocker` :** **reporté** — migration majeure hors scope
   staging-readiness ; impact limité aux tests locaux/CI, pas au runtime Cloud Run.
   Ne pas utiliser `npm audit fix --force`.

## Gate CI

Le workflow conserve `npm audit --audit-level=high` (0 high / 0 critical exigés).
