
<!DOCTYPE html>
<html>
	<head>
		<!--Entête de la page d'accueil Bidson Eroish-->
		<meta charset="utf-8" />
		<!--[if lt IE 9]
<script 
src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>
<![endif]-->
		<script type="text/javascript" src="menu.js"></script>
		<link rel="stylesheet" href="style3.css"> 
		<!--[if lte IE 7]>
<link rel="stylesheet" href="style_ie.css" />
<![endif]--> 
		
		<title>Ajouter news</title>
	</head>
	<body>
		<form action="" method="post">
			<label for="pseudo">Votre pseudo :</label> <input type="text" name="pseudo" id="pseudo" /><br />
			<label for="titre">Titre de la news :</label> <input type="text" name="titre" id="titre" /><br />
			<label for="contenu">Contenu de la news :</label> <br />
			<textarea name="contenu" id="contenu" rows="20"
			cols="60"></textarea><br />
			<input type="submit" value="Ajouter la news" />
		</form>

		<?php
			if(isset($_POST['titre']) && isset($_POST['contenu']) &&
			isset($_POST['pseudo'])) {
			//On définit les variables
			$titre = $_POST['titre'];
			$contenu = $_POST['contenu'];
			$pseudo = $_POST['pseudo'];
			//Puis on récupère les news qui existent déjà, et on stocke le tout dans $news
			$news = unserialize(file_get_contents('news.txt'));
			//On ajoute les données de la news à la suite de l'array
			$news[] = array('titre' => $titre, 'auteur' => $pseudo, 'contenu'
			=> $contenu);
			//Et pour finir, on enregistre le tout
			file_put_contents('news.txt', serialize($news));
			echo 'La news a bien été ajoutée !';
			} else {
			//Affichage du formulaire
			}?>
		
	</body>
</html>
		





