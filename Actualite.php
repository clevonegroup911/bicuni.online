<?php include_once __DIR__ . '/components.php'; ?>
<!DOCTYPE html>
<html lang="fr">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="bicuni-modern.css">
		<title>Actualité | BICUNI</title>
	</head>
	<body>
		<?php bicuni_header('actualite'); ?>
		<main class="page-shell">
			<div class="page-title">
				<p class="eyebrow">Actualité BICUNI</p>
				<h1>Articles, sciences et événements académiques</h1>
				<p>Gardez le menu de catégories à portée de main et parcourez les nouvelles sous forme de cartes modernes.</p>
			</div>
			<button type="button" class="sidebar-open" data-sidebar-open>Catégories</button>
			<div class="content-layout">
				<?php
				bicuni_category_sidebar(array(
					array('Articles', 'Articles/Articles.php'),
					array('Sciences', 'bibliotheque.php'),
					array('Technologie', 'bibliotheque.php'),
					array('Événements', 'bibliotheque.php'),
					array('Bourses', 'bibliotheque.php'),
					array('Informatique', 'bibliotheque.php')
				), false, 'Actualité');
				?>
				<section class="news-grid">
					<?php
					$cards = array();
					try {
						$bdd = new PDO('mysql:host=localhost;dbname=test;charset=utf8', 'root', '');
						$reponse = $bdd->query('SELECT titre, contenu FROM news ORDER BY id DESC LIMIT 0,6');
						while ($donnees = $reponse->fetch(PDO::FETCH_ASSOC)) {
							$cards[] = array('Articles', $donnees['titre'], strip_tags($donnees['contenu']));
						}
						$reponse->closeCursor();
					} catch (Exception $e) {
						$cards = array();
					}
					if (count($cards) === 0) {
						$cards = array(
							array('Articles', 'Travail et réussite aux études', 'Méthodes, discipline et ressources pour accompagner les étudiants dans leur progression.'),
							array('Sciences', 'Veille scientifique', 'Sélection de contenus pour comprendre les avancées et les débats académiques.'),
							array('Technologie', 'Culture numérique', 'Ressources sur l’informatique, les outils et les usages modernes.'),
							array('Événements', 'Rencontres et compétitions', 'Programmes, annonces et initiatives de la communauté BICUNI.'),
							array('Bourses', 'Bourses et prix de mérite', 'Opportunités destinées aux étudiants, auteurs et chercheurs.'),
							array('Articles', 'Publications récentes', 'Un accès rapide aux nouveaux contenus disponibles dans la bibliothèque.')
						);
					}
					foreach ($cards as $index => $card) {
						bicuni_news_card($card[0], $card[1], $card[2]);
					}
					?>
				</section>
			</div>
		</main>
		<?php include("footer.php"); ?>
		<script src="bicuni-modern.js"></script>
	</body>
</html>
