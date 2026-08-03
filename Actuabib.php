<?php include_once __DIR__ . '/components.php'; ?>
<!DOCTYPE html>
<html lang="fr">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="bicuni-modern.css">
		<title>Bibliothèque | BICUNI</title>
	</head>
	<body>
		<?php bicuni_header('bibliotheque'); ?>
		<main class="page-shell">
			<div class="page-title">
				<p class="eyebrow">Bibliothèque</p>
				<h1>Documents, auteurs et nouveautés BICUNI</h1>
				<p>Une bibliothèque claire, académique et premium, avec la sidebar noire conservée comme repère visuel principal.</p>
			</div>
			<?php bicuni_auth_bar(); ?>
			<div class="library-toolbar">
				<form class="library-search" method="post" action="Recherche.php">
					<input type="search" name="search" maxlength="200" placeholder="Rechercher un document, un auteur, une catégorie...">
					<button type="submit">Rechercher</button>
				</form>
				<button type="button" class="sidebar-open" data-sidebar-open>Filtres</button>
			</div>
			<div class="content-layout">
				<?php
				bicuni_category_sidebar(array(
					array('Sciences', '#Sciences'),
					array('Éditions', '#Editions'),
					array('Nouveautés', '#Nouveautes'),
					array('Religions', '#Religions'),
					array('Auteurs', '#Auteurs'),
					array('Arts', '#Arts'),
					array('Musique', '#Musique'),
					array('Technologie', '#Technologie'),
					array('Informatique', '#Informatique'),
					array('Langues', '#Langues')
				), true, 'Filtres');
				?>
				<section>
					<div class="document-grid">
						<?php
						bicuni_document_card('Sciences', 'Questionnaire Items', 'PDF et document Word disponibles pour consultation académique.');
						bicuni_document_card('Articles', 'Travail et réussite aux études', 'Article pédagogique pour étudiants, auteurs et chercheurs.');
						bicuni_document_card('Technologie', 'MS Office Word 2010', 'Support pratique pour renforcer les compétences numériques.');
						bicuni_document_card('Nouveautés', 'Sélection récente', 'Ressources ajoutées et contenus mis en avant par BICUNI.');
						bicuni_document_card('Auteurs', 'Espace auteurs', 'Découvrir, publier et organiser les œuvres disponibles.');
						bicuni_document_card('Langues', 'Ressources linguistiques', 'Documents et supports pour l’apprentissage et la recherche.');
						?>
					</div>
					<?php bicuni_pricing_cta(); ?>
				</section>
			</div>
		</main>
		<?php include("footer.php"); ?>
		<script src="bicuni-modern.js"></script>
	</body>
</html>
