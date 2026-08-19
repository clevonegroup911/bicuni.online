# Matrice de configuration Cloud Run

Cette matrice décrit uniquement les **noms** et les points d’injection. Elle ne
contient aucune valeur. Les secrets doivent être liés à une version précise de
Secret Manager après validation en staging; les autres paramètres appartiennent
à la configuration de chaque service ou Job Cloud Run.

Légende : `R` obligatoire, `C` conditionnelle, `O` optionnelle, `N` non utilisée
par le runtime actuel. « Validation » indique la protection réellement présente
au démarrage ou au premier usage; `à ajouter` interdit de considérer la variable
comme validée au démarrage.

| Nom | Secret | Obligation | Consommateur | Emplacement | Validation actuelle |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | oui | R web, migration, worker | Prisma | Secret Manager | Prisma au premier accès; `prisma validate` ne teste pas la connexion |
| `AUTH_SECRET` | oui | R web | Auth.js | Secret Manager | Auth.js; contrôle explicite au démarrage à ajouter |
| `AUTH_URL` | non | C web | Auth.js, origine publique de repli | configuration | URL HTTP(S); HTTPS exigé en production hors loopback au premier usage |
| `AUTH_TRUST_HOST` | non | R web derrière Cloud Run | Auth.js | configuration | interprété par Auth.js; fixer à `true` uniquement sur l’infrastructure approuvée |
| `PUBLIC_APP_URL` | non | R web | emails, Stripe, CSP | configuration | URL HTTP(S); HTTPS exigé en production au premier usage |
| `APP_URL` | non | O web | origine publique de dernier recours, PID | configuration | validation par consommateur |
| `REDIS_URL` | oui | R web en production | rate limiting, cache de recherche | Secret Manager | absence/panne bloque les opérations limitées en production |
| `REDIS_KEY_PREFIX` | non | R web par environnement | rate limiting | configuration | caractères autorisés et longueur normalisés |
| `REDIS_CONNECT_TIMEOUT_MS` | non | O web | client Redis | configuration | entier positif, repli 750 ms |
| `REDIS_COMMAND_TIMEOUT_MS` | non | O web | client Redis | configuration | entier positif, repli 500 ms |
| `TRUSTED_PROXY_HOPS` | non | R web | identité réseau et audit | configuration | entier >= 0; défaut production 1 |
| `GOOGLE_CLOUD_PROJECT` | non | C web si documents privés | SDK GCS | configuration | SDK; contrôle au démarrage à ajouter |
| `GCS_BUCKET` | non | C web si documents privés | stockage documents | configuration | présence au premier usage |
| `GCS_PUBLIC_ORIGIN` | non | O web | CSP | configuration | origine HTTPS uniquement, sinon ignorée |
| `DOCUMENT_MAX_UPLOAD_BYTES` | non | R web | validation serveur upload | configuration | entier positif à valider au démarrage; valeur invalide est actuellement dangereuse |
| `NEXT_PUBLIC_DOCUMENT_MAX_UPLOAD_BYTES` | non | R build/web | UI upload | configuration de build | public; doit égaler la limite serveur |
| `MEILISEARCH_HOST` | non | R worker, C web | recherche | configuration | présence au premier usage; HTTPS/réseau privé à contrôler |
| `MEILISEARCH_MASTER_KEY` | oui | R worker | indexation Meilisearch | Secret Manager | présence au premier usage |
| `MEILISEARCH_SEARCH_KEY` | oui | C web | recherche restreinte future | Secret Manager | non consommée directement dans l’état actuel |
| `SEARCH_SYNC_SECRET` | oui | C web si endpoint sync activé | `/api/search/sync` | Secret Manager | présence et comparaison constant-time à chaque requête |
| `SEARCH_WORKER_BATCH_SIZE` | non | O worker | worker de recherche | configuration | conversion numérique; bornes explicites à ajouter |
| `RESEND_API_KEY` | oui | R web pour emails production | service email | Secret Manager | présence au premier envoi |
| `EMAIL_FROM` | non | R web pour emails production | service email | configuration | présence au premier envoi; domaine fournisseur à valider en staging |
| `RESEND_API_URL` | non | O QA uniquement | service email | configuration | HTTPS ou loopback HTTP; laisser absent en production |
| `STRIPE_SECRET_KEY` | oui | C web si paiement activé | API Stripe | Secret Manager | présence au premier checkout |
| `STRIPE_WEBHOOK_SECRET` | oui | C web si paiement activé | webhook Stripe | Secret Manager | présence et signature vérifiée à chaque webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | non | C build/web | client Stripe | configuration de build | public; validation fournisseur en staging |
| `BICUNI_PID_SCHEME` | non | O web | PID interne | configuration | valeur autorisée `BICUNI_PID` uniquement |
| `BICUNI_PID_PREFIX` | non | O web | PID interne | configuration | valeur autorisée `bcu` uniquement |
| `BICUNI_PID_ALLOWED_HOSTS` | non | O web | cibles PID | configuration | liste d’hôtes HTTPS validée par le module PID |
| `SUPER_ADMIN_EMAIL` | donnée sensible | C Job ponctuel | `admin:init` | injection éphémère | validée par le script; retirer après exécution |
| `SUPER_ADMIN_NAME` | donnée sensible | C Job ponctuel | `admin:init` | injection éphémère | validée par le script; retirer après exécution |
| `SUPER_ADMIN_PASSWORD` | oui | C Job ponctuel | `admin:init` | secret éphémère | validée par le script; ne jamais attacher au service permanent |
| `GEMINI_API_KEY` | oui | N | intégration planifiée | aucun tant qu’inactive | aucun consommateur runtime vérifié |
| `OPENAI_API_KEY` | oui | N | intégration planifiée | aucun tant qu’inactive | aucun consommateur runtime vérifié |

## Contrôle avant création d’une révision

1. Comparer les variables de la révision candidate à cette matrice sans afficher
   les valeurs ni les payloads des secrets.
2. Vérifier que chaque secret référence une version précise et que le compte de
   service n’a accès qu’aux secrets de son rôle.
3. Refuser la promotion si `REDIS_URL`, `TRUSTED_PROXY_HOPS`, les limites upload
   ou l’origine publique ne sont pas cohérents avec l’environnement.
4. Exécuter le smoke test fonctionnel de chaque intégration conditionnellement
   activée. Une simple présence de variable ne prouve pas son fonctionnement.
5. Vérifier la configuration CORS du bucket GCS pour `PUT`, `Content-Type` et
   `x-goog-meta-sha256`; ne jamais élargir l’origine à `*` en production.
