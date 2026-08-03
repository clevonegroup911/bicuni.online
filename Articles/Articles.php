<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="style.css"> 
		<link rel="stylesheet" href="w3.css">
		<script type="text/javascript" src="meni.js"></script>
		<title>Articles</title>
	</head>
	<body>
		<article class="menus">
			<p><a href="###">Tous</a><br/><a href="###">Education</a><br/><a href="###">Politique</a><br/><a href="###">Sciences</a><br/><a href="###">Milieu</a><br/><a href="###">Evenements</a><br/><a href="###">Techologie</a><br/><a href="###">Informatique</a><br/><a href="../Actualite.php">Actualité</a>
			</p>
		</article>
		<section>
			<form id="rechercheb">
				<input type ="text" name ="search" size="50" maxlength="200" id="rechercheb1"/>
				<input type="submit" value="Rechercher" id="submit1" />
			</form>
			<div class="IconesArticles">
			<?php 
					try
					{
						$bdd = new PDO('mysql:host=localhost;dbname=test', 'root', '');
					}
					catch(Eception $e)
					{
						die('Erreur : ' .$e->getMessage());
					}
					$reponse = $bdd->query('SELECT titre, auteur FROM Articles ORDER BY id LIMIT 0,5 ');
					while ($donnees = $reponse->fetch())
					{
						?>
							<a href="ArticleEroish1.php" id="titre" title="cliquez ici"><?php echo $donnees['titre']; ?></a><br/>
							 <?php echo $donnees['auteur']; ?>
						<?php
					}
					$reponse->closeCursor();
					?>
			</div>
			 <ul class="Art_pagination">
				  <li><a href="#">&laquo;</a></li>
				  <li><a href="#">1</a></li>
				  <li><a href="#">2</a></li>
				  <li><a href="#">3</a></li>
				  <li><a href="#">4</a></li>
				  <li><a href="#">5</a></li>
				  <li><a href="#">6</a></li>
				  <li><a href="#">7</a></li>
				  <li><a href="#">8</a></li>
				  <li><a href="#">9</a></li>
				  <li><a href="#">10</a></li>
				  <li><a href="#">11</a></li>
				  <li><a href="#">12</a></li>
				  <li><a href="#">13</a></li>
				  <li><a href="#">14</a></li>
				  <li><a href="#">15</a></li>
				  <li><a href="#">16</a></li>
				  <li><a href="#">17</a></li>
				  <li><a href="#">&raquo;</a></li>
			</ul>
		</section>
	</body>
</html>
		





