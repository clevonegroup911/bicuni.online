# BICUNI Persistent Identifier (BICUNI PID)

Système interne et propriétaire d’identifiants pérennes. Ce n’est **pas** un DOI officiellement enregistré auprès d’une DOI Registration Agency. BICUNI n’a pas de préfixe DOI attribué.

Le préfixe interne autorisé est exclusivement `bcu`. Le schéma autorisé est exclusivement `BICUNI_PID`.

Un BICUNI PID n’est pas un DOI. `Publication.internalDoi` reste réservé à un vrai DOI enregistré auprès d’une Registration Agency. Aucun identifiant local ne peut être présenté comme DOI.

## Mode DOI : fail-closed

Toute génération locale `scheme=DOI` est interdite. `BICUNI_PID_SCHEME=DOI`, un préfixe `10.x`, `10.bcu` ou `10.87878/bicuni.*` sont rejetés. Aucune variable d’environnement ne suffit à activer un mode DOI.

Un futur DOI réel devra passer par un module registrar / Registration Agency distinct. Ce module n’est pas préparé ici.

## Modèle

- **Identifiant immuable** : `{prefix}/{suffix}`, unique. Exemple : `bcu/2026.art.{ULID}`.
- **Destination modifiable** : `targetUrl`, historisée dans `PersistentIdentifierTargetHistory`.
- **Schéma** : `BICUNI_PID` uniquement (préfixe `bcu`).
- **Statuts** : `ACTIVE` (302), `DEPRECATED` (302 conservé), `TOMBSTONE` (410, identifiant conservé, état terminal).

Une publication documentaire a au plus un PID primaire. `resourceType` est exclusivement `DOCUMENT` (ou `PUBLICATION` pour une publication distincte). `resourceId` est obligatoire et pointe vers `Document.id` ou `Publication.id` : aucun PID orphelin. ART / BOOK / THESIS / PAPER / DATASET / REPORT / COURSE / MEDIA sont des `suffixType` uniquement (`PID_SUFFIX_TYPES`) : le PID reste `bcu/2026.art.{ULID}` avec `resourceType = DOCUMENT`. `suffixType` n’accepte jamais `DOCUMENT` ni `PUBLICATION`. La contrainte `UNIQUE(resourceType, resourceId)` est la clé métier. Un changement de version met à jour la page canonique ; l’identifiant reste le même.

`Publication.internalDoi` n’est jamais rempli avec un BICUNI PID. Les faux DOI historiques `10.87878/bicuni.*` restent masqués.

PostgreSQL refuse tout INSERT hors BICUNI PID (`scheme = BICUNI_PID`, `prefix = bcu`, `identifier = prefix || '/' || suffix`) via CHECK + trigger `INSERT`. `resourceId` est `NOT NULL`. Un trigger `BEFORE INSERT` verrouille la ligne canonique (`SELECT … FOR KEY SHARE` sur `"Document"` ou `"Publication"` selon `resourceType`) et refuse l’INSERT si aucune ligne n’existe après acquisition du verrou ; il ne crée aucune ressource. Les champs identitaires sont immuables ; le `DELETE` physique est interdit. L’historique n’est pas en cascade (`ON DELETE RESTRICT`). L’enum `DOI` n’existe pas sur cette table : un DOI réel reste dans `Publication.internalDoi`.

## Résolution publique

```text
GET /pid/{prefix}/{suffix}
```

Exemple : `https://bicuni.online/pid/bcu/2026.art.01ARZ3NDEKTSV4RRFFQ69G5FAV`

- `ACTIVE` / `DEPRECATED` → `302 Found` vers `targetUrl`
- identifiant inconnu → `404` « Identifiant BICUNI introuvable »
- `TOMBSTONE` → `410 Gone`
- identifiant malformé (y compris préfixe `10.x`) → `400` avant toute requête SQL
- `Cache-Control: no-store`

Le résolveur ne fait aucun `fetch` serveur vers `targetUrl`. Les identifiants trop longs ou d’apparence DOI sont rejetés avant accès base.

Métadonnées publiques (DTO strict, jamais `metadata` brut) :

```text
GET /api/pids/{identifier}
```

Champs possibles : `identifier`, `scheme`, `status`, `resourceType`, `targetUrl` (si ACTIVE/DEPRECATED), `createdAt`, `updatedAt`, `title` (allowlist). Aucune donnée personnelle, IP, user-agent, note interne ou AuditLog.

## Administration

Routes protégées (`/api/admin/pids`, Back Office `/admin/pids`) :

- lecture : permission `admin:pids:read`
- création, changement de destination, dépréciation, tombstone : `admin:pids:manage`

Périmètre calculé côté serveur (jamais `institutionId` client) :

- `SUPER_ADMIN` / `ADMIN` / `MODERATOR` : accès global selon le RBAC existant
- `INSTITUTION_ADMIN` / `UNIVERSITY_ADMIN` : uniquement les PID dont la ressource appartient à leurs institutions administrées (filtre SQL `EXISTS` corrélé, sans charger tous les `resourceId`)
- hors périmètre → `404` (list/get/history), sans révéler l’existence

`prefix`, `suffix`, `identifier`, `resourceType` et `resourceId` ne sont jamais acceptés en mise à jour.

L’historique est un endpoint dédié, paginé par curseur (`changedAt DESC`, `id DESC`), `limit` défaut 20, max 50. Le détail PID ne charge pas l’historique complet.

Les transitions `targetUrl` / `status` sont atomiques (`updateMany` conditionnel). `count !== 1` → `409`. Un PID `TOMBSTONE` ne peut pas être réactivé. AuditLog et historique de destination sont écrits dans la même transaction, uniquement après succès.

## Configuration

| Variable | Rôle |
| --- | --- |
| `APP_URL` | Base publique du résolveur (`https://bicuni.online/pid/...`) |
| `BICUNI_PID_PREFIX` | Doit être `bcu` ou absent. Toute autre valeur est rejetée. |
| `BICUNI_PID_SCHEME` | Doit être `BICUNI_PID` ou absent. `DOI` est rejeté (fail-closed). |
| `BICUNI_PID_ALLOWED_HOSTS` | Hôtes HTTPS supplémentaires pour `targetUrl` |

Les destinations sont limitées à HTTPS, `bicuni.online` / `*.bicuni.online`, l’hôte de `APP_URL`, et la liste optionnelle. Les protocoles `javascript:`, `data:`, `file:`, le userinfo, les loopbacks et les réseaux privés sont rejetés.

## Création applicative

Lors de l’approbation d’un document, `ReviewService` demande un PID `DOCUMENT` via `ensureForPublishedDocument` (idempotent, clé `resourceType + resourceId`). Le suffixe conserve le type documentaire (`2026.art.{ULID}`). Appel manuel :

```ts
const pid = await new PersistentIdentifierService().create({
  resourceType: "DOCUMENT",
  suffixType: "ART",
  resourceId: document.id,
  targetUrl: documentCanonicalUrl,
  createdBy: user.id,
});
// { identifier, resolverUrl }  → resolverUrl = https://bicuni.online/pid/bcu/...
```

## Journalisation et limitation

Événements `logger` et, pour les mutations, `AuditLog` : `PID_CREATED`, `PID_RESOLVED`, `PID_TARGET_CHANGED`, `PID_DEPRECATED`, `PID_TOMBSTONED`. Les 400 de résolution ne sont pas journalisés à chaque requête. Les 404 de résolution sont dédupliqués localement (fenêtre courte) : ce n’est **pas** une protection globale Cloud Run.

La protection globale (rate limit, anti-scan) doit être appliquée à l’edge / load balancer / Cloud Armor. Aucun limiteur in-memory ne doit être présenté comme protection multi-instance.

## Immutabilité

Côté API et PostgreSQL (trigger sur la migration PID non déployée) :

- immuables : `identifier`, `scheme`, `prefix`, `suffix`, `resourceType`, `resourceId`, `createdAt`
- mutables selon workflow : `targetUrl`, `status`, `updatedAt`, `metadata`
- pas de suppression physique ; `TOMBSTONE` est l’état terminal
