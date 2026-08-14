# BICUNI.ONLINE — Project Context

## Mission

BICUNI.ONLINE est une plateforme numérique orientée étudiants, universités, institutions académiques, publication, services éducatifs et services numériques associés.

L'objectif est de construire un produit réel, fiable, monétisable et scalable.

## Principes

- Ne jamais créer de fausses universités, institutions, utilisateurs, statistiques, partenariats ou témoignages.
- Les données de démonstration doivent être explicitement identifiées comme `DEMO`, `MOCK` ou `TEST`.
- Les données institutionnelles réelles doivent provenir de sources fiables.
- Séparer clairement les fonctionnalités déjà implémentées des fonctionnalités planifiées.
- Ne jamais déclarer une fonctionnalité terminée uniquement parce que le code existe : elle doit être testée.

## Business model

Point d'entrée envisagé : abonnement à partir de **2 USD/mois**.

Le produit doit pouvoir gérer progressivement :
- abonnements ;
- plans ;
- transactions ;
- factures ;
- coupons ;
- remboursements ;
- rapports financiers ;
- paramètres de paiement ;
- journaux d'audit.

Paiements envisagés :
- Stripe ;
- M-Pesa ;
- Airtel Money ;
- Orange Money.

## Back Office

Le Back Office est le centre de contrôle de BICUNI.

Domaines fonctionnels importants :
- dashboard ;
- utilisateurs ;
- universités/institutions ;
- publications ;
- abonnements ;
- paiements ;
- factures ;
- remboursements ;
- rapports ;
- paramètres ;
- audit logs ;
- rôles et permissions ;
- monitoring.

## Exigences de développement

Pour toute fonctionnalité :
1. vérifier l'état actuel du dépôt ;
2. éviter les doublons ;
3. respecter l'architecture existante ;
4. valider frontend + backend + base de données si concernés ;
5. gérer les erreurs ;
6. vérifier sécurité et permissions ;
7. tester ;
8. lancer lint/typecheck/build ;
9. documenter ce qui a changé ;
10. ne pas casser les fonctionnalités existantes.

## Méthode de travail AI

ChatGPT Work = pilotage.
Cursor AI = implémentation principale.
Codex = contrôle technique indépendant + corrections ciblées.

Chaque tâche doit avoir :
- objectif ;
- contexte ;
- fichiers concernés ;
- critères d'acceptation ;
- contraintes ;
- tests ;
- résultat attendu.

## Définition de DONE

Une tâche est DONE seulement si :
- critères d'acceptation satisfaits ;
- tests concernés passent ;
- lint/typecheck/build passent lorsque disponibles ;
- erreurs importantes traitées ;
- permissions/sécurité vérifiées ;
- aucune donnée réelle inventée ;
- modifications documentées.
