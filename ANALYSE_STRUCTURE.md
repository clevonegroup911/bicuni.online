# Analyse et structure du projet Bicuni

## Etat actuel

Le projet est un site PHP classique, place directement dans la racine web XAMPP. Il contient 39 fichiers PHP, 4 fichiers CSS, 1 fichier JavaScript, des images, des PDF et des documents Word.

Il n'y a pas de depot Git initialise dans ce dossier. Toute modification importante devrait donc commencer par une sauvegarde ou par l'initialisation d'un depot Git.

## Structure observee

```text
www.bicuni.online/
├── index.php                 # Page d'accueil / recherche
├── Actualite.php             # Actualites + carousel + lecture news
├── Actuabib.php              # Page bibliotheque + connexion abonne
├── Inscription.php           # Formulaire d'abonnement
├── Recherche.php             # Page de recherche encore vide
├── navv.php                  # Navigation publique
├── footer.php                # Pied de page public
├── style3.css, w3.css        # Styles principaux
├── lib/                      # Classes News et acces BDD
├── news/                     # Ancien module de gestion des news
├── abonne/                   # Espace abonne
├── Articles/                 # Pages articles + photos + PDF
├── biblio/                   # Categories bibliotheque
├── livres/                   # Documents et images de livres
├── logo/                     # Logos partenaires / paiements / reseaux
├── pub/                      # Images du carousel publicitaire
└── oeuvres/                  # Documents d'oeuvres
```

## Modules fonctionnels

### 1. Pages publiques

- `index.php` affiche l'accueil et le formulaire de recherche.
- `Actualite.php` affiche un carousel publicitaire et les dernieres news.
- `Actuabib.php` affiche la bibliotheque et le formulaire de connexion abonne.
- `Inscription.php` affiche le formulaire d'abonnement.
- `Recherche.php` existe, mais ne traite pas encore la recherche.

### 2. Navigation et presentation

- `navv.php` est utilise comme menu commun.
- `footer.php` est utilise comme pied de page.
- Ces fichiers contiennent actuellement des documents HTML complets (`<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`), alors qu'ils sont inclus dans d'autres pages. Ils devraient devenir de vrais fragments partiels.

### 3. News

Deux approches coexistent:

- `lib/News.class.php`, `lib/NewsManager.class.php`, `lib/NewsManager_PDO.class.php`, `lib/NewsManager_MySQLi.class.php`: structure objet relativement propre.
- `news/liste_news.php` et `news/rediger_news.php`: ancien code procedural avec `mysql_*`, syntaxe cassee et risques SQL.

Il faut choisir une seule approche. La meilleure base est `lib/` avec PDO.

### 4. Base de donnees

Les connexions sont dispersees:

- `lib/DBFactory.class.php` utilise la base `news`.
- `Actualite.php` utilise directement la base `test`.
- `news/liste_news.php` et `news/rediger_news.php` utilisent la base `tests`.

Cette incoherence doit etre corrigee avant toute evolution serieuse. Il faut une configuration unique.

## Problemes detectes

### Erreurs PHP bloquantes

La verification avec `C:\xampp\php\php.exe -l` signale trois fichiers invalides:

- `lib/admin.php`, ligne 74: appel coupe en deux (`$news-` puis `>id()`).
- `news/liste_news.php`, ligne 41: condition `isset` mal formee.
- `news/rediger_news.php`, ligne 56: concatenation SQL incorrecte.

### Risques techniques

- Utilisation de `mysql_*`, obsolete et supprime dans les versions modernes de PHP.
- Requetes SQL directes dans les vues.
- Sorties utilisateur affichees sans echappement HTML.
- Identifiants de base de donnees en dur (`root`, mot de passe vide).
- Plusieurs bases de donnees nommees differemment: `news`, `test`, `tests`.
- `footer.php` et `navv.php` ne sont pas de vrais composants inclus.
- Encodage probablement mal interprete: textes affiches comme `ActualitÃ©` au lieu de `Actualite` accentue.
- Formulaire d'inscription sans traitement fiable visible.
- Module recherche present mais non implemente.

## Structure cible recommandee

Sans basculer tout de suite vers un framework, on peut nettoyer le site avec une structure PHP simple:

```text
www.bicuni.online/
├── public/
│   ├── index.php
│   ├── actualites.php
│   ├── bibliotheque.php
│   ├── inscription.php
│   └── recherche.php
├── app/
│   ├── config/
│   │   └── database.php
│   ├── models/
│   │   └── News.php
│   ├── repositories/
│   │   └── NewsRepository.php
│   ├── controllers/
│   │   ├── NewsController.php
│   │   ├── SearchController.php
│   │   └── SubscriberController.php
│   └── views/
│       ├── layouts/
│       │   └── main.php
│       ├── partials/
│       │   ├── nav.php
│       │   └── footer.php
│       └── pages/
├── assets/
│   ├── css/
│   ├── js/
│   ├── images/
│   ├── logos/
│   └── documents/
├── admin/
│   └── news.php
└── storage/
    └── uploads/
```

## Plan de remise en ordre

1. Initialiser un depot Git ou faire une sauvegarde complete.
2. Corriger les trois erreurs PHP bloquantes.
3. Unifier la connexion base de donnees dans un seul fichier de configuration.
4. Remplacer le vieux module `news/` par le module objet `lib/` ou par une version PDO propre.
5. Transformer `navv.php` et `footer.php` en fragments HTML sans `<html>`, `<head>` ni `<body>`.
6. Centraliser le style et les images dans un dossier `assets/`.
7. Ajouter `htmlspecialchars()` sur toutes les donnees affichees.
8. Implementer vraiment `Recherche.php`.
9. Clarifier le traitement de `Inscription.php` et de `abonne/abonne.php`.
10. Renommer les pages avec une convention stable, par exemple tout en minuscules.

## Priorite conseillee

La priorite n'est pas de tout reorganiser d'un coup. Il vaut mieux commencer par rendre l'existant stable:

1. Syntaxe PHP valide.
2. Connexion BDD unique.
3. Module news fonctionnel.
4. Fragments `nav` et `footer` propres.
5. Recherche et inscription ensuite.

Cette approche limite les regressions et permet de moderniser progressivement le site.
