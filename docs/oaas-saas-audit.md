# T052 — Audit SaaS → OaaS

**Branche :** `feat/bicuni-oaas-core`  
**Base :** SHA fondation paiement `910f5b1f5b709c2df195476e63ef6699612c71bc` (ancêtre de HEAD)  
**Règle :** ne supprimer aucun élément avant migration et tests.

## Légende

| Classe | Signification |
|--------|----------------|
| CONSERVER | Réutiliser tel quel |
| ADAPTER | Étendre / brancher OaaS |
| DÉPRÉCIER | Ne plus pousser commercialement ; garder pour legacy |
| REMPLACER | Remplacer le rôle principal par OaaS |

## Fondations paiement — CONSERVER

| Élément | Chemin | Note |
|---------|--------|------|
| Stack CLEVONE | `lib/payments/clevone/*` | Idempotence, MFA, dual-control |
| State machine paiement | `lib/payments/clevone/state-machine.ts` | `canActivate("PAID")` |
| Prisma Payment* | `prisma/schema.prisma` | PaymentOrder → Intent → Receipt |
| Pay workspace | `app/(site)/pay/[ref]/*` | Agnostique produit |
| Admin reconciliation | `app/admin/reconciliation/` | Critique |
| Webhooks Stripe | `app/api/payments/webhooks/stripe/` | Idempotent |
| AuditLog / RBAC / PID / Documents / University | divers | Domaine académique |

## Abonnements — ADAPTER / DÉPRÉCIER / REMPLACER

| Élément | Classe | Action |
|---------|--------|--------|
| `Plan`, `Subscription` | ADAPTER | Offre secondaire (stockage, support, capacité) |
| `hasActiveSubscription` | ADAPTER | Entitlement élargi : abonnement **ou** mission active |
| `requireActiveSubscriber` | ADAPTER | Rediriger vers `/outcomes` si besoin |
| `/pricing` + `PLAN_CATALOG` | DÉPRÉCIER | Page secondaire ; centre = `/outcomes` |
| `/dashboard/subscription` | DÉPRÉCIER | Remplacé par missions comme hub |
| `manage-subscription` / portal Stripe | DÉPRÉCIER | Hors cœur OaaS |
| CTA « S’abonner » | REMPLACER | « Décrire le résultat à obtenir » |
| Admin subscriptions board | ADAPTER | Coexister avec board missions |

## Navigation — ADAPTER

| Fichier | Changement |
|---------|------------|
| `components/layout/header.tsx` | Lien Outcomes, CTA mission |
| `components/layout/sidebar.tsx` | Missions, approbations, livrables, preuves |
| `components/layout/footer.tsx` | Lien Outcomes |
| `components/ui/command-palette.tsx` | Entrées OaaS |
| `components/admin/admin-nav.tsx` | Missions |

## Surfaces nouvelles — créer

- Modèles `Outcome*` (mission, contrat, plan, tâches, agents, preuves, livrables…)
- Orchestrateur + registre d’agents
- Pack vertical « Recherche académique vérifiée »
- Pages `/outcomes`, `/dashboard/missions/*`
- Checkout paiement lié mission/jalon
