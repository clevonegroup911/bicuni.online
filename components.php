<?php
function bicuni_asset($path) {
	return $path;
}

function bicuni_logo($variant = 'mark') {
	$src = $variant === 'wordmark' ? 'bicuni.png' : 'bicun.png';
	$alt = $variant === 'wordmark' ? 'BICUNI' : 'Logo BICUNI';
	return '<a class="bicuni-logo" href="index.php" aria-label="Accueil BICUNI"><img src="' . bicuni_asset($src) . '" alt="' . $alt . '"><span>BICUNI</span></a>';
}

function bicuni_subscribe_button($label = 'Abonnement') {
	return '<a class="subscribe-button" href="Inscription.php">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>';
}

function bicuni_mobile_nav() {
	return '<button class="mobile-nav-toggle" type="button" aria-label="Ouvrir le menu" aria-expanded="false" data-mobile-nav><span></span><span></span><span></span></button>';
}

function bicuni_header($active = 'recherche') {
	$items = array(
		'recherche' => array('Recherche', 'index.php'),
		'actualite' => array('Actualité', 'Actualite.php'),
		'bibliotheque' => array('Bibliothèque', 'Actuabib.php')
	);
	echo '<header class="app-header"><div class="header-shell">';
	echo bicuni_logo('mark');
	echo '<nav class="primary-nav" aria-label="Navigation principale">';
	foreach ($items as $key => $item) {
		$class = $active === $key ? ' class="active"' : '';
		echo '<a' . $class . ' href="' . $item[1] . '">' . $item[0] . '</a>';
	}
	echo '</nav>';
	echo '<div class="header-actions"><a class="login-link" href="Actuabib.php#connexion">Connexion</a>' . bicuni_subscribe_button('Abonnement') . bicuni_mobile_nav() . '</div>';
	echo '</div><div class="mobile-menu" data-mobile-menu>';
	foreach ($items as $key => $item) {
		$class = $active === $key ? ' class="active"' : '';
		echo '<a' . $class . ' href="' . $item[1] . '">' . $item[0] . '</a>';
	}
	echo '<a href="Actuabib.php#connexion">Connexion</a><a class="mobile-subscribe" href="Inscription.php">Abonnement</a></div></header>';
}

function bicuni_search_hero() {
	echo '<section class="search-hero"><div class="hero-content">';
	echo '<div class="hero-logo"><img src="bicuni.png" alt="BICUNI"></div>';
	echo '<p class="eyebrow">Recherche académique universelle</p>';
	echo '<h1>Bibliothèque Centrale Universelle</h1>';
	echo '<p class="hero-copy">Explorez des documents, articles et ressources fiables dans une interface simple, directe et pensée pour l’étude.</p>';
	echo '<form class="premium-search" method="post" action="Recherche.php"><label for="search-main">Rechercher dans BICUNI</label><div class="search-control"><input id="search-main" type="search" name="search" maxlength="200" placeholder="Rechercher un ouvrage, un auteur, une discipline..."><button type="submit">Chercher</button></div></form>';
	echo '<div class="hero-actions"><a class="primary-cta" href="Inscription.php">Commencer à 2$/mois</a><a class="secondary-cta" href="Actuabib.php">Explorer la bibliothèque</a></div>';
	echo '</div><div class="hero-panel" aria-label="Aperçu BICUNI">';
	echo '<div class="metric-card"><strong>10+</strong><span>Catégories</span></div><div class="metric-card accent"><strong>24h</strong><span>Accès numérique</span></div><div class="mini-library"><span>Sciences</span><span>Technologie</span><span>Arts</span><span>Langues</span></div>';
	echo '</div></section>';
}

function bicuni_category_sidebar($categories, $dark = false, $title = 'Catégories') {
	$class = $dark ? 'category-sidebar dark' : 'category-sidebar';
	echo '<aside class="' . $class . '" data-sidebar><div class="sidebar-head"><h2>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h2><button type="button" class="sidebar-close" data-sidebar-close aria-label="Fermer">×</button></div><div class="category-list">';
	foreach ($categories as $category) {
		$label = is_array($category) ? $category[0] : $category;
		$href = is_array($category) ? $category[1] : '#';
		echo '<a href="' . $href . '">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>';
	}
	echo '</div></aside>';
}

function bicuni_news_card($tag, $title, $text, $image = '') {
	$tone = strtolower(str_replace(
		array('é', 'è', 'ê', 'à', 'ç', ' '),
		array('e', 'e', 'e', 'a', 'c', '-'),
		$tag
	));
	$style = $image ? ' style="background-image:url(' . htmlspecialchars($image, ENT_QUOTES, 'UTF-8') . ')"' : '';
	echo '<article class="news-card"><div class="news-image tone-' . htmlspecialchars($tone, ENT_QUOTES, 'UTF-8') . '"' . $style . '><span>' . htmlspecialchars($tag, ENT_QUOTES, 'UTF-8') . '</span></div><div class="card-body"><span class="tag">' . htmlspecialchars($tag, ENT_QUOTES, 'UTF-8') . '</span><h3>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h3><p>' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</p><a href="#">Lire l’article</a></div></article>';
}

function bicuni_document_card($type, $title, $meta) {
	echo '<article class="document-card"><span class="doc-type">' . htmlspecialchars($type, ENT_QUOTES, 'UTF-8') . '</span><h3>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h3><p>' . htmlspecialchars($meta, ENT_QUOTES, 'UTF-8') . '</p><a href="#">Consulter</a></article>';
}

function bicuni_auth_bar() {
	echo '<section class="auth-bar" id="connexion"><form action="abonne/abonne.php" method="post"><div><label for="pseudo">Pseudo ou e-mail</label><input type="text" name="pseudo" id="pseudo" placeholder="exemple@bicuni.online"></div><div><label for="pass">Mot de passe</label><input type="password" name="mot_de_passe" id="pass" placeholder="Votre mot de passe"></div><button type="submit">Connexion</button></form>' . bicuni_subscribe_button('Abonnez-vous') . '</section>';
}

function bicuni_pricing_cta() {
	echo '<section class="pricing-cta"><div><span>Accès premium</span><h2>Commencez à 2$/mois</h2><p>Débloquez la bibliothèque, les nouveautés et les ressources académiques depuis un espace unique.</p></div>' . bicuni_subscribe_button('S’abonner maintenant') . '</section>';
}
?>
