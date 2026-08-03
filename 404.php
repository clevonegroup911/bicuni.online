<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8"/>
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>Page d'erreur</title>
		<style>
			nav{background-color: black;}
			body{font-family: tahoma;}
			.error{color: red;font-size: 1.6em;margin-left: 3%;}
			button{
				color:red;
				background-color:transparent;
				border: solid 1px red;
				border-radius: 5px;
				font-size: 1.4em;
				width: 20%;
				height: 45px;
				margin-left: 4%;
				cursor: pointer;
				text-align: center;}
		</style>
	</head>
	<body>
		<?php require_once('navv.php');?>
					<p class="error"><?php
					switch($_GET['404'])
					{
					case '400':
					echo 'Échec de l\'analyse HTTP.';
					break;
					case '401':
					echo 'Le pseudo ou le mot de passe n\'est pas correct !';
					break;
					case '402':
					echo 'Le client doit reformuler sa demande avec les bonnes
					données de paiement.';
					break;
					case '403':
					echo 'Requête interdite !';
					break;
					case '404':
					echo 'Une erreur est survenue sur cette page';
					break;
					case '405':
					echo 'Méthode non autorisée.';
					break;
					case '500':
					echo 'Erreur interne au serveur ou serveur saturé.';
					break;
					case '501':
					echo 'Le serveur ne supporte pas le service demandé.';
					break;
					case '502':
					echo 'Mauvaise passerelle.';
					break;
					case '503':
					echo ' Service indisponible.';
					break;
					case '504':
					echo 'Trop de temps à la réponse.';
					break;
					case '505':
					echo 'Version HTTP non supportée.';
					break;
					default:
					echo 'Il y a eu une erreur !';
					}
					?></p>
		<a href="Index.php"><button>Cliquez ici</button></a>
	</body>
	</html>