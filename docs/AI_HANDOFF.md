# BICUNI AI Handoff

## BIC-SEC-002 — contrats back-end Sprint 002

- `GET /api/profile` retourne `{ profile }` pour l’utilisateur authentifié.
- `PATCH /api/profile` accepte uniquement `name`, `image`, `bio`, `title`, `country`, `orcid`, `website`, `researchFields`, `universityId`, `departmentId`, avec permission `profile:write`. Les champs inconnus (notamment rôle, statut, email ou userId) donnent `400`. Un département doit appartenir à l’institution active fournie.
- `POST /api/payments/portal` retourne `{ url }` pour le customer Stripe appartenant à la session; retour fixe vers `/dashboard/subscription`.
- `POST /api/subscriptions/cancel` exige `{ atPeriodEnd: true }`, programme `cancel_at_period_end`; l’appel est idempotent et ne permet pas de choisir l’abonnement d’un autre utilisateur.
- `GET /api/invoices?page=N&limit=1..50` retourne `{ invoices, pagination }`, filtré exclusivement via les abonnements de la session.
- `POST /api/payments/checkout` accepte toujours `{ planSlug }`; l’en-tête facultatif `Idempotency-Key` (8–128 caractères alphanumériques, `:`, `_`, `-`) stabilise les doubles soumissions. Le plan et le montant restent chargés côté serveur.
- `POST /api/auth/resend-verification` accepte `{ email }` et répond toujours de façon neutre; il renouvelle le jeton seulement pour un compte réellement en attente.
- Coupons/remboursements: contrat métier à valider avant modèle ou migration; proposition dans `docs/production-readiness.md`.

## BIC-UI-002 — profil, abonnement, facturation (15 août 2026)

**TASK_ID :** BIC-UI-002
**Branche :** `ai/cursor/BIC-UI-002`
**Worktree :** `~/Projects/bicuni.cursor.sprint-002`
**Statut :** READY_FOR_REVIEW
**Commit / push / merge / déploiement :** NON

Parcours UI finalisés sans toucher Prisma, Auth, JWT, middleware, webhooks Stripe, rate limiting, CSP ni e-mail serveur. Aucune sauvegarde, paiement, coupon ou remboursement n’est simulé.

### Pages terminées

- `/dashboard/profile` — édition (nom, titre, bio, pays, ORCID, site, domaines, université, faculté UI, département, URL d’avatar)
- `/dashboard/subscription` — plan, statut, tarif, devise, périodicité, échéance, annulation programmée, historique, portail Stripe, confirmation d’annulation
- `/dashboard/invoices` — liste paginée réelle (date, numéro, montant, devise, statut, PDF/hostedUrl)
- `/admin/invoices` — liste paginée BO (`admin:audit:read`), données `Invoice` Prisma existantes

### Pages partielles / non opérationnelles

- `/admin/coupons` et `/admin/refunds` — état **non configuré** (pas de modèle Prisma). Composants réutilisables prêts (`CouponBoard`, `CouponForm`, `RefundBoard`, `RefundRequestForm`).
- Enregistrement profil, portail Stripe et annulation : l’UI appelle les API réelles ; si Codex ne les a pas encore livrées, l’écran affiche l’indisponibilité (404/405/501) sans succès fictif.

### Contrats API attendus de Codex

1. **`PATCH /api/profile`**
   - Auth session ACTIVE, propriétaire, permission `profile:write` déjà au RBAC.
   - Corps : `{ name, title, bio, country, orcid, website, image, researchFields, universityId, departmentId }` (champs Prisma existants uniquement).
   - **Pas de `facultyId`** : la faculté se déduit de `Department.faculty`. Valider `department.faculty.universityId === universityId`.
   - `image` : URL http(s) ou chemin relatif, **pas d’upload GCS** (stockage actuel = documents privés).
   - Réponses : 200 profil persisté ; 400/409 validation (ORCID unique) ; 401 session ; 403 interdit.
   - Fichier de contrat : `lib/profile/contract.ts`.

2. **`POST /api/payments/portal`**
   - Auth session. Corps `{ returnUrl? }`. Succès **uniquement** `{ url }` Stripe Billing Portal.
   - 503 si `STRIPE_SECRET_KEY` absente ; 404 si pas de `stripeCustomerId`.
   - L’UI n’invente jamais l’URL. Contrat : `lib/billing/contracts.ts` (`STRIPE_PORTAL_CONTRACT`).

3. **`POST /api/subscriptions/cancel`**
   - Corps `{ atPeriodEnd: true }`. Annulation en fin de période uniquement, via Stripe puis `cancelAtPeriodEnd`.
   - Pas d’annulation immédiate ni de remboursement depuis l’UI. Contrat : `SUBSCRIPTION_CANCEL_CONTRACT`.

4. **Coupons / remboursements** — schéma + routes listés dans `COUPON_API_CONTRACT` et `REFUND_API_CONTRACT`. Tant que les modèles n’existent pas, ne pas activer `configured: true`.

### Décisions UI

- Avatar : affichage de `User.image` s’il s’agit d’une URL sûre ; pas de sélecteur de fichier (GCS documentaire privé).
- Stripe non configuré : bandeau explicite, boutons portail/annulation masqués.
- Factures : uniquement les lignes `Invoice` / webhooks ; état vide réel si aucune.
- Navigation : Factures dans la sidebar utilisateur ; Factures / Coupons / Remboursements dans la nav BO filtrée par `admin:audit:read`.

### Passage à Codex

Implémenter `PATCH /api/profile`, `POST /api/payments/portal` et `POST /api/subscriptions/cancel` selon les contrats ci-dessus, sans modifier les pages Cursor. Ne pas créer de coupons/remboursements fictifs. Vérifier que les 401 du profil redirigent bien via l’UI existante (`/login?next=/dashboard/profile`).

---

## BIC-UI-001-FREEZE — gel Cursor du 15 août 2026

**TASK_ID :** BIC-UI-001-FREEZE
**Branche :** `bicuni-001-cleanup` (inchangée, HEAD `c20682b`)
**Heure du gel :** 2026-08-15T17:08:20+01:00 (2026-08-15T16:08:20Z)
**Statut :** READY_FOR_REVIEW
**Commit / push / merge / déploiement :** NON
**Dernière écriture Cursor autorisée :** ce fichier uniquement.

Le sprint UI est gelé pour le Quality Gate Codex. Aucune nouvelle modification UI, aucun commit, aucun changement de branche, aucune suppression. Les processus Cursor susceptibles d’écrire dans le dépôt (Next.js `dev` :3120, `next start` :3000, `dev` :3130, `next start` :3150) ont été arrêtés. Une session Codex sandbox déjà ouverte conserve un accès en écriture (Quality Gate, non arrêtée).

### Pages UI modifiées (dirty vs HEAD)

- `app/layout.tsx`, `app/loading.tsx`, `app/error.tsx` (nouveau), `app/not-found.tsx` (nouveau)
- `app/(site)/layout.tsx`, `app/(site)/page.tsx`, `app/(site)/library/page.tsx`, `app/(site)/news/page.tsx`, `app/(site)/pricing/page.tsx`
- `app/(site)/documents/page.tsx`, `app/(site)/documents/upload/page.tsx`, `app/(site)/documents/[id]/page.tsx`, `app/(site)/documents/[id]/edit/page.tsx`
- `app/(site)/universities/page.tsx` (nouveau)
- `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/documents/page.tsx`, `app/dashboard/loading.tsx` (nouveau)
- `app/dashboard/favorites/page.tsx`, `app/dashboard/history/page.tsx`, `app/dashboard/profile/page.tsx`, `app/dashboard/settings/page.tsx`, `app/dashboard/subscription/page.tsx` (nouveaux)
- `app/university/layout.tsx`
- `app/admin/[module]/page.tsx`, `app/admin/audit/page.tsx`, `app/admin/denied/page.tsx`, `app/admin/users/page.tsx`
- `app/admin/payments/page.tsx`, `app/admin/subscriptions/page.tsx` (nouveaux)
- CSS : `app/globals.css`, `app/layout.css`, `app/landing.css`, `app/search.css`, `app/admin.css`, `app/accessibility.css`

### Composants UI modifiés (dirty vs HEAD)

- Modifiés : `components/layout/header.tsx`, `footer.tsx`, `sidebar.tsx`, `components/logo.tsx`, `components/dashboard-shell.tsx`, `components/search-box.tsx`
- Auth : `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `verify-email.tsx`
- Documents : `comment-section.tsx`, `document-actions.tsx`, `document-grid.tsx`, `metadata-form.tsx`, `metadata-edit-form.tsx`, `pdf-preview.tsx`, `workflow-actions.tsx`
- Admin : `admin-login-form.tsx`, `admin-shell.tsx`
- Marketing / abonnement / UI : `entity-cards.tsx`, `statistics-cards.tsx`, `checkout-button.tsx`, `command-palette.tsx`
- Nouveaux : `components/layout/site-header.tsx`, `components/admin/admin-nav.tsx`, `components/documents/catalog-filters.tsx`, `load-public-catalog.ts`, `persistent-identifier.tsx`, `components/ui/field.tsx`, `pagination.tsx`, `copy-button.tsx`

### Fichiers E2E modifiés

- `e2e/primary-user-journey.spec.ts` (parcours UI Cursor)
- `e2e/backend-critical.spec.ts` (lot Codex ; présent dans le worktree dirty)

### Fonctionnalités terminées (UI lots 1–6 + stabilisation)

- Design system, navigation publique responsive (hamburger ≤1080 px, Escape, skip-link), layouts site/dashboard/université
- Auth visuelle accessible ; espace utilisateur (favoris, historique, profil lecture, paramètres, abonnement)
- Catalogue public (filtres, tri, pagination, repli d’erreur Prisma) ; upload ; fiche document + PID visuel ; édition avec garde anti-perte ; rejet en modal
- Bibliothèque, recherche CSS, page `/universities` (établissements avec publication validée uniquement)
- Plans présentés comme propositions commerciales ; checkout client avec `try/catch` (serveur inchangé par Cursor)
- Back-office : nav filtrée RBAC, listes paiements/abonnements, pagination utilisateurs, états vides
- 404 / erreur professionnelles avec cible skip-link

### Fonctionnalités partielles

- Profil utilisateur : lecture seule (pas d’API `PATCH /api/profile`)
- Abonnement : pas d’annulation ni de changement de plan côté API ; l’UI le dit
- BO coupons / remboursements / factures : écrans « en préparation » (pas de modèles Prisma)
- Favori : état initial lu via Prisma sur la fiche ; pas de GET dédié pour les autres vues
- `/documents/upload` hors middleware : sans session, un échec `requireUser` peut afficher `error.tsx` (200) au lieu d’une 307
- E2E production complets après gel : non relancés (volontaire)
- `scripts/ui-smoke-sprint.mjs` : absent du worktree au gel (n’a pas été recréé)

### Problèmes connus

- Worktree partagé Cursor + Codex : fichiers back-end dirty (`auth.ts`, `app/api/**`, `lib/auth/**`, `lib/payments/**`, `lib/search/indexer.ts`, `.htaccess`, etc.) — propriété Codex, non touchés par ce gel
- Session Codex sandbox encore ouverte avec accès écriture (Quality Gate) — non arrêtée
- Catalogue public local vide (état réel) ; volume PostgreSQL existant sans colonne `University.acronym` et sans migrations PID appliquées (volontaire)
- Build final unique + E2E jetables encore requis par Codex sur ce snapshot figé
- P1 produit hors UI : API profil, annulation d’abonnement, rate limit Redis multi-instance (voir sections QA)

### Tests déjà exécutés (lot Cursor, avant gel)

- `npx tsc --noEmit` : réussi
- `npm run lint` : réussi
- `npm test` : 42 fichiers, 274 tests réussis
- `git diff --check` : réussi
- `npm run build` : réussi
- Playwright production (`:3150`) : parcours publics, overflow 1280/1000/390, hamburger, labels auth, tri catalogue — aucun document public dans la base locale

### Isolation gel

- Aucun commit, push, merge, déploiement
- Branche inchangée
- Aucune suppression de fichier par cette tâche
- Processus Cursor d’écriture arrêtés : OUI
- Prochaine action : Codex Quality Gate sur ce snapshot (lint, typecheck, tests, build, E2E jetables)

## BIC-SPRINT-001-UI — revue et stabilisation Cursor du 15 août 2026

**Statut UI : READY_FOR_REVIEW.** **Statut d’intégration du worktree : NON PRÊT.** Aucun commit, push, déploiement, migration de la base existante ou secret modifié. Branche inchangée : `bicuni-001-cleanup`. Les fichiers Codex (`auth.ts`, `middleware.ts`, `app/api/**`, webhooks, `lib/auth/**`, `lib/payments/**`, Prisma) n’ont pas été touchés par ce lot.

### Parcours vérifiés (navigateur)

Serveur de production local `http://127.0.0.1:3150` après `npm run build`, plus un passage Playwright headless (Chrome). PostgreSQL et Meilisearch locaux étaient actifs ; le catalogue public de cette base est vide (état vide réel, aucune donnée inventée).

| Parcours | Résultat |
|---|---|
| Accueil, bibliothèque, documents, recherche, universités, plans, actualité | 200, navigation publique, skip-link, pas d’overflow 1280/1000/390 |
| Inscription / connexion / mot de passe oublié | 200, labels `for=`, CTA inscription → connexion après succès |
| Tableau de bord / université / admin | 307 vers login avec `next=` |
| Téléversement `/documents/upload` | Hors middleware ; sans session la page a renvoyé 200 via `error.tsx` au lieu d’une 307 (`requireUser` sans `next`) — P2 back-end |
| Fiche document + PID | Aucun document public dans cette base → état vide réel ; le bloc PID et le favori prérempli sont en place dans le code |
| Menu tablette 1000 px | Hamburger visible après chargement CSS, Escape ferme le menu |
| 404 | Page professionnelle avec `#page-content` |

### Correctifs UI de ce lot

- Navigation : hamburger dès 1080 px (plus de trou 900–1080) ; Escape + blocage du scroll ; `aria-current` mobile.
- Accueil : bouton filtres mort remplacé par un lien `/search` ; statistique « 100 % » fictive retirée.
- Catalogue : tri visible (récent / vues) ; pages publiques résilientes si Prisma est indisponible (message d’erreur, pas de zéros présentés comme des stats réelles).
- Document : état initial du favori lu via Prisma existant ; prévisualisation et commentaires selon session ; métadonnées sans fuite de titre privé.
- Auth / paiement : lien connexion après inscription ; checkout avec `try/catch` ; partage/téléchargement/favori avec erreurs hors flex.
- Accessibilité : cibles skip-link sur 404/erreur ; chargements sans styles de layout inline.

### Tests Cursor (ce lot)

- `npx tsc --noEmit` : réussi.
- `npm run lint` : réussi.
- `npm test` : 42 fichiers, 274 tests réussis.
- `git diff --check` : réussi.
- `npm run build` : réussi (pages dynamiques + `/admin/login` statique).
- Playwright production : parcours publics, overflow, hamburger, auth labels, tri catalogue, avertissement tarifaire.

## BIC-SPRINT-001-QA — contrôle Codex du 15 août 2026

**Statut d’intégration : NON PRÊT.** Aucun commit, push, déploiement, migration de base existante ou secret modifié. Le baseline récupérable est conservé sous `/tmp/bicuni-qa-baseline.BWgh8S` (HEAD, status, patch binaire, index et liste des fichiers non suivis).

### Corrections back-end Codex

- Webhook Stripe : journal d’idempotence et traitement métier réunis dans une transaction; seul `P2002` est traité comme doublon, les autres erreurs ne sont plus acquittées à tort.
- Auth : révocation des JWT émis avant le dernier reset de mot de passe utilisé; rate limit Redis partagé lorsqu’il est configuré, avec repli local explicite.
- Documents : validation serveur de la cohérence université → faculté → département à l’upload et à l’édition.
- Recherche : timestamps UTC dans l’outbox; backoff et compteurs `attempted`/`processed` exacts quand Meilisearch est indisponible.
- Origine publique : HTTP reste refusé en production sauf loopback strict pour les smoke tests locaux du build.
- Héritage PHP : retrait des 12 redirections `.htaccess` vers `localhost/sites/www.bicuni.com`; les erreurs utilisent désormais `/404.php` en chemin relatif.
- E2E back-end : le cleanup ne tente plus de supprimer physiquement un document protégé par un PID.

### Validations exécutées

- `npx prisma validate` : réussi.
- `npm run lint` : réussi sur l’instantané QA avant les derniers changements Cursor.
- `npm run typecheck` : réussi sur l’instantané final lancé avant le dernier build.
- `npm test` : 42 fichiers, 274 tests réussis.
- Tests ciblés finaux (origine, rate limit, hiérarchie documentaire, recherche) : 5 fichiers, 14 tests réussis.
- `git diff --check` : réussi.
- Base PostgreSQL jetable `/tmp` : les 5 migrations, les 5 plans et `search:outbox` ont été appliqués avec succès; aucune base existante touchée.
- E2E production avant corrections finales : 5 réussis, 10 ignorés, 3 échoués. Workflow documentaire/RBAC, abonnements et absence d’overflow desktop/tablette/mobile ont réussi. Les échecs ont confirmé le timestamp non UTC de l’outbox, la politique HTTP loopback et un cleanup incompatible avec l’immuabilité PID; ces trois causes ont été corrigées, mais le rerun complet n’a pas pu aller au bout.
- `npm run build` : deux réussites intermédiaires à 50 pages; échec final pendant les contrôles Next (`PageNotFoundError` de cache lors d’une course, puis worker code 1 sans diagnostic). Le build final n’est pas reproductible pendant les modifications Cursor concurrentes.

### Risques et conflits restants

- Cursor a continué à modifier ses fichiers UI et `e2e/primary-user-journey.spec.ts` pendant le QA. Aucun de ces changements n’a été écrasé; ils exigent un rerun sur un snapshot figé.
- Le test E2E complet après les corrections finales et un build final vert restent obligatoires.
- Redis doit être configuré en environnement multi-instance; sans `REDIS_URL`, le repli mémoire ne fournit qu’une protection par instance.
- Les triggers PID ont été réellement exécutés sur PostgreSQL jetable pendant les E2E (création et protection contre suppression observées), mais le script de concurrence PID isolé dédié n’a pas été relancé dans ce tour.
- Les P1 fonctionnels déjà signalés (état initial favori, API profil, annulation/changement d’abonnement) restent hors de ce lot QA de stabilisation.

### Prochaine action recommandée

Figer le worktree Cursor, relancer dans cet ordre `npx prisma validate`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, puis les E2E sur une nouvelle base PostgreSQL jetable avec le serveur de production. Ne pas intégrer tant que build et E2E finaux ne sont pas verts sur le même snapshot.

## Tâches actives

| ID | Agent | Branche | Périmètre | Fichiers | Statut |
|---|---|---|---|---|---|
| BIC-UI-001-FREEZE | Cursor | `bicuni-001-cleanup` | Gel du sprint UI pour Quality Gate | `docs/AI_HANDOFF.md` uniquement | READY_FOR_REVIEW |
| BIC-SPRINT-001-UI | Cursor | `bicuni-001-cleanup` | Revue fonctionnelle + stabilisation du parcours principal | `app/(site)/**`, `app/dashboard/**`, `components/**`, CSS, `e2e/primary-user-journey.spec.ts` | READY_FOR_REVIEW (gelé) |
| BIC-UI-001 | Cursor | `bicuni-001-cleanup` | Interface lots 1–6 (préalable) | pages/composants/CSS | READY_FOR_REVIEW (gelé) |
| BIC-SPRINT-001-QA | Codex | `bicuni-001-cleanup` (même worktree) | Idempotence Stripe, JWT, rate limit, cohérence documentaire, recherche | `auth.ts`, `app/api/**`, `lib/auth/**`, `lib/payments/**`, `.htaccess` | Voir section QA — ne pas écraser |

**Isolation :** Cursor et Codex partagent le même worktree. Ce lot Cursor n’a pas changé de branche, n’a pas commité, n’a pas poussé, n’a pas déployé. Les fichiers Codex listés en READ_ONLY/FORBIDDEN n’ont pas été modifiés par Cursor.

### BIC-UI-001 — propriété des fichiers

```text
OWNED_FILES
  app/(site)/** (hors API)
  app/dashboard/**
  app/admin/** (pages/composants visuels uniquement)
  app/university/layout.tsx
  app/*.css
  app/layout.tsx
  app/error.tsx
  app/not-found.tsx
  components/**

READ_ONLY_FILES
  auth.ts
  middleware.ts
  lib/auth/**
  lib/admin/**
  prisma/**
  app/api/**
  lib/payments/**
  lib/storage/index.ts
  lib/pid/** (sauf status-page déjà touché en présentation)

FORBIDDEN_FILES
  .env
  prisma/migrations/**
  app/api/payments/webhooks/**

SHARED_FILES
  docs/AI_HANDOFF.md
  lib/documents/document-service.ts  (filtres listPublic — revue Codex requise)
  lib/pid/status-page.ts             (HTML uniquement — revue Codex requise)
```

## État Git initial

- Branche : `bicuni-001-cleanup`.
- HEAD initial : `c20682b chore: install BICUNI AI operating system`.
- Modifications préexistantes préservées : `README.md`, routes `forgot-password`, `register`, `checkout`, et nouveau dossier `lib/http/`.
- Aucun commit, push, déploiement, paiement, reset de base ou migration appliquée pendant cet audit.

## Architecture confirmée

- Application active : Next.js 15 App Router, React 19, TypeScript, Auth.js, Prisma/PostgreSQL.
- Services : GCS privé, Stripe, Meilisearch, Redis optionnel.
- L'héritage PHP est conservé à la racine mais exclu de l'image Next.js par le `Dockerfile`.
- Les contrôles administratifs sont appliqués côté serveur via `requireAdminApi`, RBAC et scopes institutionnels.
- Le PID BICUNI est interne et distinct d'un DOI enregistré.

## Travaux Codex réalisés

- Audit statique Git, routes API, Auth/RBAC, workflow documentaire, upload privé, Prisma/migrations, PID, Stripe, Docker et CI.
- Correction Stripe : Checkout transmet désormais le montant, la devise et l'intervalle du plan chargé en base, avec validation stricte avant appel fournisseur.
- Ajout de tests unitaires pour la construction du tarif récurrent Stripe.
- Les changements préexistants sur l'origine publique configurée ont été conservés et validés par leurs tests.

## Travaux réservés à Cursor

- Design global, responsive et cohérence visuelle.
- Composants et tableaux de bord visuels.
- Navigation, accessibilité visuelle, états de chargement, pages vides et messages utilisateur.
- Ne pas modifier Auth/RBAC, les routes API, les migrations, le stockage, Stripe ou PID pour une raison purement visuelle.

## Travaux Cursor constatés

- Phase produit/front exécutée sur `bicuni-001-cleanup` sans commit, push, déploiement ni modification des secrets.

## Fichiers sensibles

- `auth.ts`, `middleware.ts`, `lib/auth/**`, `lib/admin/**`.
- `prisma/schema.prisma`, `prisma/migrations/**`.
- `app/api/payments/**`, `lib/payments/**`.
- `app/api/documents/**`, `lib/documents/**`, `lib/storage/index.ts`.
- `app/api/pids/**`, `app/pid/**`, `lib/pid/**`.
- `.env.example`, `Dockerfile`, `next.config.ts`.

## Tests exécutés

- `npx prisma validate` : réussi.
- `npm run lint` : réussi sur l'instantané final.
- `npm run typecheck` : réussi sur l'instantané final.
- `npm test` : 41 fichiers, 270 tests réussis sur l'instantané final.
- `npm test -- lib/payments/stripe.test.ts` : 1 fichier, 3 tests réussis.
- `git diff --check` : réussi après la correction Stripe.
- `npm run build` : réussi, compilation et 43/43 pages statiques générées.
- `npm start` : serveur de production démarré localement après autorisation.
- Smoke tests : `/`, `/login`, `/signup`, `/documents`, `/documents/upload`, `/library`, `/search` et `/pricing` ont répondu; `/dashboard`, `/dashboard/documents` et `/university` ont redirigé vers la connexion comme attendu. Les routes dépendant de Prisma n'ont pas pu être validées complètement car PostgreSQL n'était pas actif (`localhost:5432`); `/pid/bcu/test` a répondu 500 pour cette raison.

## Problèmes restants

- P0 : aucun confirmé par l'inspection statique.
- P1 : l'idempotence Stripe acquitte immédiatement un événement concurrent déjà inséré; si le premier traitement échoue ensuite, le doublon a déjà reçu HTTP 200. Prévoir un état `PROCESSING/PROCESSED/FAILED` ou un traitement atomique verrouillé avant production.
- P1 : le rate limiting d'authentification/upload est en mémoire locale et ne protège pas globalement plusieurs instances Cloud Run; utiliser Redis ou un service distribué avant production.
- P1 : la réinitialisation de mot de passe ne révoque pas explicitement les JWT déjà émis. Ajouter une version de session ou un horodatage de révocation vérifié dans le callback JWT.
- P1 : la cohérence `universityId/facultyId/departmentId` n'est pas validée explicitement à la création/mise à jour documentaire; empêcher les associations inter-institutions incohérentes.
- P1 opérationnel : les triggers PID ont été inspectés et couverts par tests structurels, mais leur exécution réelle sur PostgreSQL n'a pas encore été confirmée dans cette phase.
- P2 : ajouter une CSP adaptée et documenter les origines nécessaires.
- P2 : durcir les contraintes Prisma/SQL des montants, devises et intervalles de plans au-delà de la validation applicative Stripe.
- P2 : réévaluer l'archivage séparé de l'héritage PHP afin qu'il ne soit jamais servi par erreur hors de l'image Next.js.

## Prochaine action

1. Démarrer une base PostgreSQL locale jetable et terminer les smoke tests dépendants de Prisma.
2. Corriger l'état transactionnel des webhooks Stripe avant préproduction.
3. Ajouter rate limiting distribué et révocation JWT avant production.
4. Exécuter les migrations PID sur une base PostgreSQL jetable dédiée, jamais sur les données existantes sans procédure de baseline.
5. Codex : revue sécurité/API des ajouts UI (filtres `listPublic`, pages admin paiements/abonnements, PID HTML).

## Travaux Cursor réalisés

Lots 1 à 6 exécutés sur l’architecture existante (pas de nouveau template).

- Lot 1 : design system (Inter/Poppins), CSS landing/search consolidés, navigation publique, layouts dashboard/université, 404/erreur.
- Lot 2 : formulaires d’authentification accessibles, espace utilisateur avec sidebar, favoris, historique, profil, paramètres, abonnement.
- Lot 3 : catalogue documents (filtres/pagination), upload, détail PID, édition avec garde anti-perte, workflow de rejet en modal.
- Lot 4 : bibliothèque, recherche (CSS manquant complété), page publique `/universities`, pages d’erreur PID.
- Lot 5 : plans sans styles inline, mentions de prix proposés, checkout inchangé côté serveur, espace abonnement réel.
- Lot 6 : back-office (nav filtrée par permission, transactions, abonnements, pagination utilisateurs, états vides).

## Composants ajoutés

- `components/layout/site-header.tsx` — en-tête serveur avec session.
- `components/admin/admin-nav.tsx` — navigation BO filtrée par RBAC.
- `components/ui/field.tsx`, `pagination.tsx`, `copy-button.tsx`.
- `components/documents/catalog-filters.tsx`, `persistent-identifier.tsx`, `load-public-catalog.ts`.
- Pages : `/universities`, `/dashboard/favorites`, `/dashboard/history`, `/dashboard/profile`, `/dashboard/settings`, `/dashboard/subscription`, `/admin/payments`, `/admin/subscriptions`, `app/not-found.tsx`, `app/error.tsx`.

## Pages modifiées

- Navigation/layouts : header, footer, sidebar, `app/layout.tsx`, `(site)/layout.tsx`, `dashboard/layout.tsx`, `university/layout.tsx`.
- Auth : login, signup, forgot/reset password, verify-email, admin login.
- Dashboard, documents (liste/upload/détail/édition), library, pricing, users, audit, denied, module BO en préparation.
- PID : `lib/pid/status-page.ts` (présentation uniquement, pas de logique de résolution).

## Décisions UI

- Dark mode anthracite conservé ; Inter pour le texte, Poppins pour les titres.
- Logo officiel concentrique conservé (`Bi` bleu, `cuni` rouge).
- Navigation publique : Bibliothèque, Recherche, Documents, Universités, Plans, Connexion, Inscription. Le lien Administration n’est plus dans le pied de page public ; il n’apparaît dans l’en-tête que pour un rôle administratif.
- `/university` reste le portail institutionnel authentifié. La liste publique est `/universities`, alimentée uniquement par des établissements ayant au moins une publication validée.
- Terminologie PID : « Identifiant pérenne BICUNI » / « PID BICUNI ». Un DOI n’est affiché que s’il est réellement enregistré (`registeredDoi`).
- Prix des plans présentés comme propositions commerciales, pas comme tarif contractuel définitif.
- Aucune statistique, université, paiement ou favori fictif. Données absentes → état vide + action suivante.
- `DocumentService.listPublic` accepte désormais des filtres optionnels (catégorie, type, université, année, tri) pour les pages serveur. Aucune route API, webhook, Prisma ou middleware modifié par Cursor.

## Problèmes back-end détectés

| Priorité | API / zone | Observé | Attendu | Fichier possible |
|---|---|---|---|---|
| P2 | Favori | L’UI préremplit désormais l’état via `documentFavorite` sur la fiche. Un GET dédié reste utile pour d’autres vues. | Endpoint GET optionnel, ou champ `favorited` dans une API document. | `app/api/documents/[id]/favorite/route.ts` |
| P1 | Profil | Lecture seule : pas d’API de mise à jour du profil / affiliation. | `PATCH /api/profile` authentifié, validé, avec cohérence université/département. | `app/api/` à créer ; `prisma` Profile déjà présent |
| P2 | Abonnement | Pas d’annulation ni de changement de plan côté API. L’UI le dit clairement. | Endpoint d’annulation Stripe (fin de période) + portail client. | `app/api/payments/**`, `lib/payments/stripe.ts` |
| P2 | `GET /api/subscriptions/current` | Utile, mais les pages serveur lisent Prisma directement. | Conserver ; éventuellement y joindre factures/paiements. | `app/api/subscriptions/current/route.ts` |
| P2 | Coupons / remboursements | Pas de modèles Prisma. Pages BO laissées « en préparation ». | Schéma + API avant tout écran métier. | `prisma/schema.prisma` |
| P2 | `requireUser` | Redirige vers `/login` sans `next`. `/documents/upload` n’est pas dans le middleware : sans session, un échec de `auth()`/Prisma affiche `error.tsx` (200) au lieu d’une 307. | Aligner les guards sur `?next=` et/ou protéger `/documents/upload` dans le middleware. | `lib/auth/guards.ts`, `middleware.ts` |
| P1 op. | PostgreSQL local | Docker `postgres` + `meilisearch` démarrés pour ce sprint. Catalogue public vide sur cette instance. Migrations PID `20260810150000` et `20260813120000` non appliquées sur le volume existant (volontaire). | Base jetable dédiée pour E2E complets, jamais `migrate deploy` sur les données existantes sans baseline. | opérationnel |

Les P1 Codex (idempotence Stripe, rate limit distribué, révocation JWT, cohérence institutionnelle documentaire) restent valides. Non modifiés.

## Tests Cursor

- `npx tsc --noEmit` : réussi (lot UI du 15 août).
- `npm run lint` : réussi.
- `npm test` : 42 fichiers, 274 tests réussis.
- `git diff --check` : réussi.
- `npm run build` : réussi après le lot UI.
- Playwright (production `:3150`) : accueil, auth, catalogues, overflow, hamburger 1000 px, 404. Aucun document public dans la base locale (état vide réel).

## Passage à Codex

Merci de vérifier, sans écraser le lot UI :

- le snapshot figé demandé en QA (lint, typecheck, tests, build, E2E) maintenant que le lot UI est READY_FOR_REVIEW ;
- `requireUser` / middleware pour `/documents/upload` (200 `error.tsx` observé sans session) ;
- lecture Prisma `documentFavorite` sur la fiche document (pas de nouvelle route) ;
- `loadPublicCatalog` / `loadCatalogFacets` (repli d’erreur UI, pas d’exposition de brouillons) ;
- Stripe / webhooks / `auth.ts` / migrations : non touchés par Cursor dans ce lot.

## Intégration finale Codex — BIC-QA-001-FINAL-INTEGRATION (15 août 2026)

### Gel et périmètre

- Branche contrôlée : `bicuni-001-cleanup`, HEAD `c20682b`.
- Le statut Git, le diff et les horodatages des fichiers sont restés identiques pendant une fenêtre de contrôle de 10 secondes ; aucun processus Cursor/Next/TypeScript/Playwright actif n'a été détecté au gel.
- Aucun commit, push, déploiement, reset, migration de la base configurée ou modification de secret n'a été effectué.
- Le diff intégré contient les lots UI Cursor et les corrections back-end Codex. Aucun changement de `package.json`, lockfile, schéma Prisma, migration, middleware, Dockerfile ou `.gitignore` n'a été constaté sur l'instantané final.

### Corrections d'intégration

- Le nettoyage E2E documentaire conserve désormais les catégories, universités, auteurs et éditeurs encore référencés par un document protégé par PID.
- Les scénarios Auth E2E attendent l'hydratation avant la déconnexion, isolent leur identité de rate limiting et valident explicitement le statut HTTP de l'inscription.
- Les corrections Codex déjà présentes dans le diff ont été revues : traitement Stripe transactionnel/idempotent, révocation des JWT après reset, fallback Redis/local du rate limiting, cohérence de la hiérarchie institutionnelle et origine publique contrôlée.

### Base de données et exécution réelle

- La PostgreSQL déclarée dans `.env` (`localhost:5432`) n'était pas joignable ; elle n'a pas été modifiée.
- Une PostgreSQL jetable sous `/tmp`, sans données existantes, a reçu les 5 migrations par `prisma migrate deploy`, les 5 plans officiels et les triggers d'outbox de recherche.
- Les triggers PID d'identité immuable et de liaison à la ressource ont été présents et exercés par le workflow E2E réel.
- Smoke production : routes publiques principales en HTTP 200, routes privées `/dashboard`, `/university` et `/admin` redirigées vers leur connexion, PID inexistant en 404 et PID existant en 302 vers sa ressource canonique.

### Gates finaux

- `npx prisma validate` : réussi.
- `npm run lint` : réussi.
- `npm run typecheck` : réussi.
- `npm test` : 42 fichiers, 274 tests réussis.
- `npm run test:e2e` : 8 réussis, 10 ignorés intentionnellement (écritures desktop non dupliquées sur tablette/mobile), aucun échec. Les contrôles responsive sans overflow passent sur desktop, tablette et mobile.
- `npm run build` : réussi sur l'instantané intégré.
- `git diff --check` : réussi.

### Risques et prérequis restants

- P1 opérationnel : la base locale configurée n'était pas disponible ; la reproductibilité a été prouvée sur une base jetable, mais le volume local existant doit suivre sa procédure de baseline avant tout `migrate deploy`.
- P1 opérationnel : `RESEND_API_KEY` et `EMAIL_FROM` sont requis pour les parcours d'inscription/récupération en production. Les E2E utilisent uniquement le transport de développement ; aucun secret factice n'a été ajouté.
- P2 : Redis doit être configuré en déploiement multi-instance ; le fallback mémoire est validé mais n'est global qu'à un processus.
- P2 : ajouter une CSP adaptée et conserver l'héritage PHP hors de l'image et du routage Next.js.
- Fonctionnalités non bloquantes toujours non implémentées : édition de profil, annulation/portail Stripe, coupons et remboursements.

### Statut d'intégration

- `READY_FOR_COMMIT` sous réserve de fournir les variables d'email et Redis dans l'environnement cible et d'appliquer la procédure de baseline à toute base existante.
- Prochaine action : revue humaine du diff complet, puis commit unique ou commits thématiques sur `bicuni-001-cleanup`. Aucun push ni déploiement n'a été effectué.
