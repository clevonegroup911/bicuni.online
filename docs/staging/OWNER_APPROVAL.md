# Demande d’autorisation propriétaire — staging BICUNI OaaS

## Contexte

Le code OaaS est intégré dans `main` (`5cca6d0`). Ce lot prépare l’IaC et les
runbooks. **Aucune ressource cloud n’a été créée.**

## Décisions demandées (cocher)

### A. Périmètre

- [ ] Autoriser la **création** du staging isolé décrit dans `ARCHITECTURE.md`
- [ ] Refuser / reporter

### B. Option de coût (`COSTS.md`)

- [ ] Option A — économique (recommandée pour démarrer)
- [ ] Option B — représentative
- [ ] Hybride (préciser) : _______________________

### C. Accès réseau

- [ ] Staging **authentifié uniquement** (`allow_unauthenticated=false`) — recommandé
- [ ] Autoriser `allUsers` invoker (public) — justification : _____________

### D. Nom d’hôte

- [ ] `staging.bicuni.online` (implique activation DNS / enregistrement — décision séparée si API DNS off)
- [ ] URL Cloud Run protégée seulement (pas de DNS custom)

### E. Redis

- [ ] Sans Memorystore (Option A)
- [ ] Avec Memorystore (activer `redis.googleapis.com` — facturable)

### F. Secrets

- [ ] Autoriser la création des secrets **noms** `*_STAGING` + versions TEST
- [ ] Stripe TEST / Resend TEST / AUTH_SECRET staging fournis par le propriétaire hors bande

### G. Exécuteurs IA externes

État actuel à conserver jusqu’à décision :

```text
11 DETERMINISTIC_LOCAL · 4 ADAPTER_NOT_CONFIGURED · 2 DISABLED · 0 REAL_EXECUTOR
```

- [ ] Conserver **0** exécuteur IA réel
- [ ] Autoriser plus tard un provider (choisir) :
  - [ ] OpenAI
  - [ ] Anthropic Claude
  - [ ] Google Gemini / Vertex
  - Budget mensuel IA max USD : ________

### H. GitHub

- [ ] Autoriser création environment `staging` + secrets Actions (noms)
- [ ] Ajouter protection de branche `main` (required checks) avant apply

### I. Apply

- [ ] Autoriser un **prochain lot** à exécuter `terraform apply` + deploy
  `bicuni-staging` uniquement
- [ ] Interdit d’appliquer tant que cette case n’est pas cochée

## Comparatif providers IA (à valider — aucun câblage réel)

Tarifs indicatifs consultés le **2026-09-20** (sources fabricants — non garantis).

| Fournisseur | Modèles envisagés | Dispo géo | Prix indicatif | Données / rétention | Limites | Compat. missions académiques |
| --- | --- | --- | --- | --- | --- | --- |
| OpenAI | famille GPT (API) | Global ; residency EU éligible (+≈10 %) | selon modèle — voir [pricing OpenAI](https://developers.openai.com/api/docs/pricing) | ZDR / residency sur plans éligibles | quotas org ; pas de simulation BICUNI | utile rédaction assistée **avec** garde-fous anti-fabrication |
| Anthropic | Claude Sonnet / Opus | Global ; options région via cloud partners | ex. Sonnet ~2–10 USD / MTok — [pricing Claude](https://platform.claude.com/docs/en/about-claude/pricing) | DPA / SCCs ; residency selon plateforme | rate limits ; academic discounts possibles | bon pour synthèse sourcée si citations fournies |
| Google Gemini / Vertex | Gemini Flash / Pro | Vertex régions EU possibles | Flash intro ~0.75 / 3.75 USD / MTok global — [pricing Google](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) | Pin région Vertex ; ZDR option | endpoint global ≠ EU | intégration GCP naturelle ; grounding optionnel |

**Rappel :** tant qu’aucun provider n’est choisi + clé fournie +
`OAAS_EXTERNAL_EXECUTOR_ENABLED=1`, l’interface renvoie
`DISABLED` / `ADAPTER_NOT_CONFIGURED` — **jamais** une fausse réponse.

## Signature

Propriétaire : _________________  
Date : _________________  
Référence PR staging-readiness : _________________
