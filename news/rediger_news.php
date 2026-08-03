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
		<style type="text/css">
			h1, h3
			{
			text-align:center;
			}
			h3
			{
			background-color:black;
			color:white;
			font-size:0.9em;
			margin-bottom:0px;
			}
			.news p
			{
			background-color:#CCCCCC;
			margin-top:0px;
			}
			.news
			{
			width:70%;
			margin:auto;
			}
		</style>
		<!--[if lte IE 7]>
<link rel="stylesheet" href="style_ie.css" />
<![endif]--> 
		<style type="text/css">
		h3, form
		{
			text-align: center;
		}
		</style>
		
		<title>Liste news</title>
	</head>
	<body>
		<h3><a href="liste_news.php">Retour à la liste des news</a></h3>
		<?php 
		mysql_connect('localhost', 'root', '');
		mysql_select_db("tests");
		if (isset ($_GET['modifier_news']))
		{
			$_GET['modifier_news'] =
			mysql_real_escape_string(htmlspecialchars($_GET['modifier_news']));
			$retour = mysql_query('SELECT * FROM news WHERE id=\'' $_GET['modifier_news'] . '\'');
				$donnees = mysql_fetch_array($retour);
				$titre = stripslashes($donnees['titre']);
				$contenu = stripslashes($donnees['centenu']);
				$id_news = $donnees['id'];
			}
			else
			{
				$titre = '';
				$contenu = '';
				$id_news = 0;
			}
			?>
			<form action="liste_news.php" method="post" enctype="multipart/form-data">
			<p>Titre: <input type="text" size="30" name="titre" value="<?php echo $titre; ?>" /><br/><br/>
			<input type="hidden" name="MAX_FILE_SIZE" value="1048576" />
			<input type="file" name="icone" id="icone" value="<?php echo $photo; ?>" /></p>
			<p>
			Contenu:<br/>
			<textarea name="contenu" cols="50" rows="10" <?php echo $contenu; ?>></textarea><br/>
			<input type="hidden" name="id_news" value="<?php echo $id_news; ?>" />
			<input type="submit" value="Envoyer" />
			</p>
			</form>
	</body>
</html>
		





