# AGENTS.md — BICUNI

Ces règles sont permanentes pour tout agent travaillant dans ce dépôt.

## 1. Avant toute modification

Inspecte le dépôt avant de coder.

Lis au minimum :
- `PROJECT_CONTEXT.md`
- `package.json` si présent
- README
- fichiers de configuration pertinents
- schéma/database/migrations concernés
- code existant lié à la tâche.

N'invente pas l'architecture.

## 2. Règle anti-doublon

Avant de créer :
- composant ;
- hook ;
- service ;
- route ;
- endpoint ;
- modèle ;
- table ;
- utilitaire ;

cherche d'abord s'il existe déjà.

Préférer étendre/réutiliser plutôt que dupliquer.

## 3. Données

Interdit :
- fausses universités présentées comme réelles ;
- faux utilisateurs présentés comme réels ;
- faux paiements présentés comme réels ;
- fausses statistiques de production.

Les fixtures/tests doivent porter un marquage clair.

## 4. Sécurité

Ne jamais :
- exposer secrets ou tokens ;
- committer `.env`;
- faire confiance aux données client ;
- contourner auth/RBAC ;
- enregistrer des données de carte bancaire sensibles ;
- désactiver une protection juste pour faire passer un test.

Pour les routes sensibles :
- authentification ;
- autorisation ;
- validation d'entrée ;
- gestion d'erreur ;
- journalisation adaptée.

## 5. Paiements

Pour Stripe/Mobile Money :
- idempotence ;
- vérification des webhooks ;
- séparation sandbox/production ;
- statut transactionnel explicite ;
- audit trail ;
- aucune confiance dans le prix envoyé par le client.

Le serveur doit déterminer les montants autorisés.

## 6. Qualité

Après modification, exécuter les contrôles disponibles :
- tests ;
- lint ;
- typecheck ;
- build.

Ne prétends jamais qu'une commande est passée si elle n'a pas été exécutée.

## 7. Scope

Ne refactorise pas arbitrairement des zones sans rapport avec la tâche.

Si un problème adjacent bloque réellement la tâche, corrige le minimum nécessaire et documente-le.

## 8. Réponse finale d'un agent

Toujours indiquer :
1. ce qui a été modifié ;
2. fichiers principaux ;
3. commandes/tests exécutés ;
4. résultats ;
5. risques/restes ;
6. prochaine action recommandée.
