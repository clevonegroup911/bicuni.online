<?php
require 'lib/autoload.inc.php';
$db = DBFactory::getMysqlConnexionWithMySQLi();
$manager = new NewsManager_MySQLi($db);
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Accueil du site</title>
</head>
<body>
<p><a href="admin.php">Accéder à l'espace d'administration</a></p>
<?php
if (isset($_GET['id']))
{
	$news = $manager->getUnique((int) $_GET['id']);
	echo '<p>Par <em>', $news->auteur(), '</em>, ', $news->dateAjout(), '</p>', "\n", '<h2>', $news->titre(), '</h2>', "\n", '<p>', nl2br($news->contenu()), '</p>', "\n";
	if ($news->dateAjout() != $news->dateModif())
	{
		echo '<p style="text-align: right;"><small><em>Modifiée ', $news->dateModif(), '</em></small></p>';
	}
}
else
{
	echo '<h2 style="text-align:center">Liste des 5 dernières news</h2>';
	foreach ($manager->getList(0, 5) as $news)
{
if (strlen($news->contenu()) <= 200)
{
	$contenu = $news->contenu();
}
else
{
	$debut = substr($news->contenu(), 0, 200);
	$debut = substr($debut, 0, strrpos($debut, ' ')) . '...';
	$contenu = $debut;
	}
		echo '<h4><a href="?id=', $news->id(), '">', $news->titre(),'</a></h4>', "\n", '<p>', nl2br($contenu), '</p>';
	}
}
?>
<?php
if (isset($_GET['id']))
{
	$news = $manager->getUnique((int) $_GET['id']);
	echo '<p>Par <em>', $news->auteur(), '</em>, ', $news->dateAjout(), '</p>', "\n", '<h2>', $news->titre(), '</h2>', "\n", '<p>', nl2br($news->contenu()), '</p>', "\n";
	if ($news->dateAjout() != $news->dateModif())
	{
		echo '<p style="text-align: right;"><small><em>Modifiée ', $news->dateModif(), '</em></small></p>';
	}
}
else
{
	echo '<h2 style="text-align:center">Liste des 5 dernières news</h2>';
	foreach ($manager->getList(0, 5) as $news)
{
if (strlen($news->contenu()) <= 200)
{
	$contenu = $news->contenu();
}
else
{
	$debut = substr($news->contenu(), 0, 200);
	$debut = substr($debut, 0, strrpos($debut, ' ')) . '...';
	$contenu = $debut;
	}
		echo '<h4><a href="?id=', $news->id(), '">', $news->titre(),'</a></h4>', "\n", '<p>', nl2br($contenu), '</p>';
	}
}
?>
</body>
</html>