# Déploiement production Cloud Run — BICUNI.ONLINE

Procédure contrôlée, reproductible et réversible pour construire une image immuable,
appliquer les migrations via un Cloud Run Job, puis basculer le trafic sur
`bicuni-online` uniquement après validation.

**Ne jamais** déployer automatiquement depuis Cloud Build vers la production.
**Ne jamais** exécuter `prisma migrate reset` sur une base contenant des données.
**Ne jamais** committer de secrets, fichiers `.env` ou mots de passe.

## Contexte production confirmé

| Élément | Valeur |
| --- | --- |
| Projet GCP | `bicuni-504414` |
| Région | `europe-west1` |
| Service Cloud Run | `bicuni-online` |
| Image Artifact Registry | `europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni` |
| Compte de service | `bicuni-runtime@bicuni-504414.iam.gserviceaccount.com` |
| Instance Cloud SQL | `bicuni-504414:europe-west1:bicuni-postgres` |
| Secrets Secret Manager | `DATABASE_URL`, `AUTH_SECRET` |
| Révision stable de secours | `bicuni-online-00001-vjc` |

## Principes de sécurité

- `DATABASE_URL` et `AUTH_SECRET` restent exclusivement dans Secret Manager.
- Aucun secret n’est ajouté à Git, à `cloudbuild.yaml`, au `Dockerfile` ou à l’image.
- L’image est taguée avec `$COMMIT_SHA` uniquement (jamais `latest`).
- Le démarrage normal du service (`npm start`) **n’exécute aucune migration**.
- Les migrations passent uniquement par le Job `bicuni-migrate`.
- L’ancienne révision reste disponible pour un retour immédiat.
- Pour les secrets injectés comme variables d’environnement, préférer une **version
  précise** du secret (ex. `DATABASE_URL:1`) plutôt que `latest` une fois la version
  de production stabilisée.

---

## 1. Vérification de `main` et du commit

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status
git rev-parse HEAD
git log -1 --oneline
```

Noter le `COMMIT_SHA` (40 caractères). Toute image et tout déploiement doivent
référencer ce commit exact.

---

## 2. Création de la sauvegarde Cloud SQL

Avant toute migration ou déploiement :

```bash
gcloud sql backups create \
  --instance=bicuni-postgres \
  --project=bicuni-504414 \
  --description="pre-deploy $(date -u +%Y%m%dT%H%M%SZ) $(git rev-parse --short HEAD)"
```

Vérifier le succès :

```bash
gcloud sql backups list \
  --instance=bicuni-postgres \
  --project=bicuni-504414 \
  --limit=5
```

Ne pas continuer si la sauvegarde n’est pas `SUCCESSFUL`.

---

## 3. Construction de l’image immuable

`cloudbuild.yaml` construit et pousse uniquement :

`europe-west1-docker.pkg.dev/$PROJECT_ID/bicuni/bicuni:$COMMIT_SHA`

Il **ne déploie pas** Cloud Run.

```bash
COMMIT_SHA="$(git rev-parse HEAD)"

gcloud builds submit \
  --project=bicuni-504414 \
  --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA="${COMMIT_SHA}",_REGION=europe-west1 \
  .
```

Image attendue :

`europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni:<COMMIT_SHA>`

---

## 4. Vérification du digest

```bash
COMMIT_SHA="$(git rev-parse HEAD)"
IMAGE="europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni:${COMMIT_SHA}"

gcloud artifacts docker images describe "${IMAGE}" \
  --project=bicuni-504414 \
  --format='get(image_summary.digest)'
```

Conserver le digest (`sha256:…`). Pour les étapes suivantes, préférer la référence
par digest lorsque possible :

```bash
IMAGE_DIGEST="europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni@sha256:<DIGEST>"
```

---

## 5. Création ou mise à jour du Cloud Run Job `bicuni-migrate`

Le Job utilise la **même image immuable** que le service, avec une commande
dédiée aux migrations.

Exemple de création (adapter si le Job existe déjà avec `gcloud run jobs update`) :

```bash
COMMIT_SHA="$(git rev-parse HEAD)"
IMAGE="europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni:${COMMIT_SHA}"

gcloud run jobs create bicuni-migrate \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --image="${IMAGE}" \
  --service-account=bicuni-runtime@bicuni-504414.iam.gserviceaccount.com \
  --set-cloudsql-instances=bicuni-504414:europe-west1:bicuni-postgres \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest \
  --command=npm \
  --args=run,db:migrate:deploy \
  --max-retries=0 \
  --task-timeout=15m
```

Si le Job existe déjà :

```bash
gcloud run jobs update bicuni-migrate \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --image="${IMAGE}" \
  --service-account=bicuni-runtime@bicuni-504414.iam.gserviceaccount.com \
  --set-cloudsql-instances=bicuni-504414:europe-west1:bicuni-postgres \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest \
  --command=npm \
  --args=run,db:migrate:deploy \
  --max-retries=0 \
  --task-timeout=15m
```

Lorsque la version de production de `DATABASE_URL` est stabilisée, remplacer
`DATABASE_URL:latest` par `DATABASE_URL:<VERSION>` (ex. `DATABASE_URL:1`).

---

## 6. Connexion du Job à Cloud SQL

Confirmée via `--set-cloudsql-instances=bicuni-504414:europe-west1:bicuni-postgres`.

Le Job doit pouvoir atteindre PostgreSQL via le connecteur Cloud SQL (socket Unix
ou IP privée selon la configuration existante de `DATABASE_URL`).

---

## 7. Compte de service `bicuni-runtime`

Le Job et le service doivent s’exécuter sous :

`bicuni-runtime@bicuni-504414.iam.gserviceaccount.com`

Ce compte doit disposer, a minima, des droits pour :

- accéder à Cloud SQL (`roles/cloudsql.client`) ;
- lire les secrets nécessaires (`roles/secretmanager.secretAccessor` sur
  `DATABASE_URL` et `AUTH_SECRET`).

Ne pas élargir les permissions au-delà du nécessaire.

---

## 8. Injection de `DATABASE_URL` depuis Secret Manager

Le Job injecte uniquement `DATABASE_URL` depuis Secret Manager :

```text
--set-secrets=DATABASE_URL=DATABASE_URL:<VERSION>
```

Aucun mot de passe, chaîne de connexion ou secret ne doit apparaître en clair dans
Git, Cloud Build, le Dockerfile ou les arguments de commande.

---

## 9. Commande du Job

```text
npm run db:migrate:deploy
```

Équivalent Prisma : `prisma migrate deploy` (migrations déjà présentes dans
`/app/prisma` de l’image).

---

## 10. Exécution du Job avec attente du résultat

```bash
gcloud run jobs execute bicuni-migrate \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --wait
```

Ne déployer le service **que si** l’exécution se termine avec succès.

---

## 11. Lecture des logs de migration

```bash
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="bicuni-migrate"' \
  --project=bicuni-504414 \
  --limit=50 \
  --format='value(timestamp,textPayload,jsonPayload.message)'
```

Vérifier l’absence d’erreur Prisma et la cohérence avec
`npm run db:migrate:status` (hors production locale, ou via un Job de statut dédié
si nécessaire).

---

## 12. Déploiement de `bicuni-online` avec `--no-traffic`

```bash
COMMIT_SHA="$(git rev-parse HEAD)"
IMAGE="europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni:${COMMIT_SHA}"

gcloud run deploy bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --image="${IMAGE}" \
  --service-account=bicuni-runtime@bicuni-504414.iam.gserviceaccount.com \
  --set-cloudsql-instances=bicuni-504414:europe-west1:bicuni-postgres \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest \
  --no-traffic \
  --tag=candidate
```

Notes :

- `--no-traffic` crée/met à jour une révision **sans** basculer le trafic public.
- Remplacer `:latest` par des versions précises une fois stabilisées.
- Ne pas déployer vers un autre nom de service (`bicuni-web` est incorrect).

---

## 13. Ajout d’un tag de révision pour le test

L’exemple ci-dessus utilise `--tag=candidate`. L’URL de test ressemble à :

```text
https://candidate---bicuni-online-<hash>-ew.a.run.app
```

Récupérer l’URL exacte :

```bash
gcloud run services describe bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --format='yaml(status.traffic,status.address,status.url)'
```

---

## 14. Tests sur la révision candidate

Sur l’URL taguée `candidate` (pas le domaine public tant que le trafic n’a pas
basculé), vérifier au minimum :

1. `GET /` — page d’accueil
2. `GET /login` — authentification utilisateur
3. `GET /admin/login` — authentification Back Office
4. `GET /admin/dashboard` — accessible uniquement après authentification admin

Exemple (remplacer `CANDIDATE_URL`) :

```bash
CANDIDATE_URL="https://candidate---bicuni-online-xxxxx-ew.a.run.app"

curl -sS -o /dev/null -w "%{http_code}\n" "${CANDIDATE_URL}/"
curl -sS -o /dev/null -w "%{http_code}\n" "${CANDIDATE_URL}/login"
curl -sS -o /dev/null -w "%{http_code}\n" "${CANDIDATE_URL}/admin/login"
curl -sS -o /dev/null -w "%{http_code}\n" "${CANDIDATE_URL}/admin/dashboard"
```

Valider aussi les journaux de la nouvelle révision avant tout basculement.

---

## 15. Basculement progressif du trafic

Exemple progressif :

```bash
# 10 % vers la nouvelle révision, 90 % sur la révision stable
gcloud run services update-traffic bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --to-tags=candidate=10

# Puis 50 %
gcloud run services update-traffic bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --to-tags=candidate=50

# Puis 100 %
gcloud run services update-traffic bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --to-tags=candidate=100
```

Surveiller erreurs, latence et logs entre chaque étape.

Alternative directe (après validation complète) :

```bash
gcloud run services update-traffic bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --to-latest
```

---

## 16. Retour vers `bicuni-online-00001-vjc` en cas d’échec

Si la candidate est défaillante :

```bash
gcloud run services update-traffic bicuni-online \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --to-revisions=bicuni-online-00001-vjc=100
```

Vérifier immédiatement `/`, `/login` et `/admin/login` sur l’URL publique.

Si une migration incompatible a été appliquée, restaurer depuis la sauvegarde
Cloud SQL **avant** de rejouer un déploiement. Documenter l’incident.

---

## 17. Initialisation du SUPER_ADMIN de production (procédure distincte)

À exécuter **une seule fois**, après migrations réussies, via un Job ponctuel ou
une exécution contrôlée de la même image — **jamais** au démarrage du service.

Variables requises (valeurs d’exemple factices uniquement) :

```bash
SUPER_ADMIN_EMAIL="admin@example.com"
SUPER_ADMIN_NAME="Super Admin"
SUPER_ADMIN_PASSWORD="RemplacerParUnMotDePasseFort"
```

Exemple d’exécution ponctuelle via Cloud Run Job (créer/mettre à jour un Job
`bicuni-admin-init` ou surcharger les variables d’une exécution) :

```bash
COMMIT_SHA="$(git rev-parse HEAD)"
IMAGE="europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni:${COMMIT_SHA}"

gcloud run jobs create bicuni-admin-init \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --image="${IMAGE}" \
  --service-account=bicuni-runtime@bicuni-504414.iam.gserviceaccount.com \
  --set-cloudsql-instances=bicuni-504414:europe-west1:bicuni-postgres \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest \
  --update-env-vars="SUPER_ADMIN_EMAIL=admin@example.com,SUPER_ADMIN_NAME=Super Admin,SUPER_ADMIN_PASSWORD=RemplacerParUnMotDePasseFort" \
  --command=npm \
  --args=run,admin:init \
  --max-retries=0 \
  --task-timeout=10m

gcloud run jobs execute bicuni-admin-init \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --wait
```

Le script est idempotent : il ne modifie pas un SUPER_ADMIN actif existant.

**Ne pas** placer `SUPER_ADMIN_PASSWORD` dans Git, dans Secret Manager de façon
permanente, ni dans la configuration durable du service `bicuni-online`.

---

## 18. Suppression immédiate des secrets temporaires SUPER_ADMIN

Dès que l’initialisation a réussi et que la connexion `/admin/login` est validée :

1. Supprimer le Job `bicuni-admin-init` **ou** retirer immédiatement les variables
   `SUPER_ADMIN_*` de sa configuration.
2. Ne jamais laisser `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME` ou
   `SUPER_ADMIN_PASSWORD` sur le service `bicuni-online`.
3. Invalider / faire tourner le mot de passe utilisé pour le bootstrap si le canal
   de transmission n’était pas strictement contrôlé.
4. Les administrateurs suivants se créent via le Back Office, pas via ce script.

Exemple de nettoyage :

```bash
gcloud run jobs delete bicuni-admin-init \
  --project=bicuni-504414 \
  --region=europe-west1 \
  --quiet
```

---

## Récapitulatif Cloud Build (phase actuelle)

`cloudbuild.yaml` se limite à :

1. construire `europe-west1-docker.pkg.dev/$PROJECT_ID/bicuni/bicuni:$COMMIT_SHA` ;
2. pousser l’image dans Artifact Registry ;
3. déclarer l’image produite dans `images:`.

Il ne contient **pas** :

- `bicuni/web`
- `bicuni-web`
- le tag `latest`
- `gcloud run deploy`

Le déploiement reste manuel, après sauvegarde, migrations et contrôles.

## Checklist pré-bascule

- [ ] Commit `main` identifié et propre
- [ ] Sauvegarde Cloud SQL réussie
- [ ] Image construite avec `$COMMIT_SHA`
- [ ] Digest vérifié
- [ ] Job `bicuni-migrate` exécuté avec succès
- [ ] Logs de migration lus et OK
- [ ] Révision `bicuni-online` déployée avec `--no-traffic` + tag `candidate`
- [ ] Tests `/`, `/login`, `/admin/login`, `/admin/dashboard` OK
- [ ] Trafic basculé progressivement
- [ ] Révision `bicuni-online-00001-vjc` toujours connue pour rollback
- [ ] Secrets `SUPER_ADMIN_*` absents du service permanent
