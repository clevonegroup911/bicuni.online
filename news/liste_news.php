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
		<style type="text/css">
		h2, th, td
		{
			text-align: center;
		}
		table
		{
			border-collapse: collapse;
			border: 2px solid black;
			margin: auto;
		}
		th, td
		{
			border: 1px solid black;
		}
		</style>
		
		<title>Liste news</title>
	</head>
	<body>
		<h2><a href="rediger_news.php">Ajouter une news</a></h2>
		<?php
		mysql_connect('localhost', 'root', '');
		mysql_select_db("tests");

		if (isset(($_POST['titre']) AND isset($_POST['contenu'] ))
		{
			$titre = addslashes($_POST['titre']);
			$contenu = addcslashes($_POST['contenu']);
			if ($_POST['id_news'] == 0)
				mysql_query("INSERT INTO news VALUES ('', '". $titre . "', '". $contenu . "', '" . time () . "')");
		}
		else
		{
			$_POST['id_news'] = addcslashes($_POST['id_news']);
			mysql_query("UPDATE news SET titre ='" . $titre . "', contenu = '" . $contenu ."' WHERE id = '" . $_POST['id_news' ] . "'");
		}
	}
	if (isset ($_GET['supprimer_news']))
	{
		$_GET['supprimer_news'] = addslashes($_GET['supprimer_news']);
		mysql_query('DELETE FROM news WHERE id =\'' . $_GET['supprimer_news'] . '\'');
	}
	?>
	<table><tr>
	<th>Modifier</th>
	<th>Suprimer</th>
	<th>Titre</th>
	<th>Date</th>
	</tr>
	<?php 
	$retour = mysql_query('SELECT * FROM news BY id DESC');
	while ($donnees = mysql_fetch_array($retour))
	{
		?>
		<tr>
		<td><?php echo '<a href="rediger_news.php?Modifier_news=' . $donnees['id'] . '">'; ?>Modifier</a></td>
		<td><?php echo '<a href="liste_news.php?supprimer_news=' $doonnes['id'] . '">'; ?>Supprimer</a></td>
		<td><?php echo stripslashes($donnees['titre']); ?></td>
		<td><?php echo date('d/m/Y, $donnees['dateModif']'); ?></td>
		</tr>
		<?php 
	}
	?>		
	</table>
	</body>
</html>
		





