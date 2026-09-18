# Passerelle de paiement CLEVONE

## Cartographie des modèles

| Concept demandé | Implémentation BICUNI |
| --- | --- |
| Customer | `User` existant |
| Order | `PaymentOrder` |
| Invoice | `Invoice` existant (`status=open` puis `paid`) |
| PaymentIntent | `PaymentIntent` |
| PaymentAttempt | `PaymentAttempt` |
| PaymentProof | `PaymentProof` (GCS privé) |
| ProviderTransaction | `ProviderTransaction` (relevés futurs) |
| ReconciliationDecision | `ReconciliationDecision` (append-only) |
| Receipt | `PaymentReceipt` (uniquement après `PAID`) |
| Refund | `PaymentRefund` |
| Notification | `PaymentNotification` |
| AuditLog | `AuditLog` existant |

Les montants sont toujours des entiers en unités minimales, avec devise ISO.

## Machine à états

`AWAITING_PAYMENT` → `PROOF_SUBMITTED` → `MATCHING` → `PENDING` | `REVIEW_REQUIRED` | `REJECTED`.

`PROOF_SUBMITTED` ne peut pas aller vers `PAID`. L’activation et le reçu acquitté n’existent qu’après `PAID`, lui-même uniquement depuis `REVIEW_REQUIRED` après **deux administrateurs distincts**.

Tant que `CLEVONE_FINANCIAL_SOURCE` n’est pas `connected`, une correspondance forte reste en `REVIEW_REQUIRED`.

Le module est un **paiement manuel contrôlé**, jamais un encaissement bancaire automatique M-PESA/RAWBANK.

## Taux USD/CDF

Le taux n’est pas une variable d’environnement. Il est stocké dans `FxRate` : source, date d’effet, auteur, approbateur, historique immuable. Le montant CDF est figé sur `PaymentOrder`, `PaymentIntent` et `Invoice` à la création (`Math.round(usdCents * rateUnits)`).

## CSRF

`assertSameOrigin` n’accorde aucune confiance au `Host` client. Seules les origines `PUBLIC_APP_URL` / `AUTH_URL` / `APP_URL` (et les alias loopback en non-production) sont acceptées. `X-Forwarded-Host` n’est lu que si `TRUSTED_PROXY_STRATEGY=cloud-run` et seulement pour confirmer une origine déjà autorisée.

## Déploiement

1. Sauvegarde PostgreSQL (`pg_dump --format=custom`).
2. `npm run db:migrate:deploy`
3. `npm run db:generate`
4. Saisir et faire approuver un taux USD/CDF durable dans `/admin/fx` (double contrôle + MFA). Sans taux actif, M-PESA et RAWBANK CDF restent indisponibles ; RAWBANK USD fonctionne.
5. Enrôler le MFA des administrateurs (`/admin/security`) avant toute confirmation `PAID` en production.
6. Vérifier `GCS_BUCKET` (preuves privées) et `RESEND_API_KEY` (notifications e-mail réelles uniquement).

Les coordonnées bénéficiaires sont lues côté serveur (`lib/payments/clevone/accounts.ts`). Les variables `CLEVONE_*` permettent un override opérationnel sans les dupliquer dans l’UI.

## Rollback

1. Arrêter les écritures de paiement (feature flag opérationnel : retirer l’accès `/pricing` CLEVONE n’annule pas les dossiers déjà `PAID`).
2. Restaurer le dump PostgreSQL dans une nouvelle instance, valider, basculer `DATABASE_URL`.
3. Ne pas supprimer manuellement des lignes `_prisma_migrations`.
4. Les objets GCS `payments/` restent privés ; une suppression n’est pas un rollback métier.

## Rétention

Les preuves sont conservées jusqu’à `retentionUntil` (24 mois). Aucune purge automatique n’est lancée sans runbook d’exploitation dédié.

## SMS / WhatsApp

Aucun fournisseur n’est connecté. Les notifications de ces canaux sont enregistrées `SKIPPED_UNCONFIGURED`. Un envoi réussi n’est jamais simulé.
