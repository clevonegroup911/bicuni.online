<!DOCTYPE html>
<html>
	<head>
		<!--Entête de la page d'accueil Bidson Eroish-->
		<meta charset="utf-8" />
		<!--[if lt IE 9]
<script 
src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>
<![endif]-->
		
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="style3.css"> 
		<link rel="stylesheet" href="w3.css">
		<script type="text/javascript" src="meni.js"></script>
		<!--[if lte IE 7]>
<link rel="stylesheet" href="style_ie.css" />
<![endif]--> 
		<title>News</title>
	</head>
	<body>
		<p><?php include("navv.php"); ?></p>
			
			<form action="Actualite.php" method="post" enctype="multipart/form-data">
				<p>Titre: <input type="text" size="30" name="titre"  /><br/><br/>
				<input type="hidden" name="MAX_FILE_SIZE" value="1048576" />
				<input type="file" name="icone" id="icone" value="icone" /></p>
				<p>
				Contenu:<br/>
				<textarea name="contenu" cols="50" rows="10" ></textarea><br/>
				<input type="hidden" name="news" value="news" />
				<input type="submit" value="Envoyer" />
				</p>
			</form>
		</section>
	</body>
</html>
		





