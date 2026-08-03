<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />			
		<script type="text/javascript" src="menu.js"></script>
		<link rel="stylesheet" href="style4.css"> 
		<title>Inscription</title>
	</head>
	<body>
		<?php include("navv.php"); ?>
		<form method="post" action="abonne/abonne.php" id="form">
			<p>
				<label for="prenom">Prénom</label>
				<input type ="text" name ="prenom" placeholder="Votre prénom" class="formleft" size="30" maxlength="10" autofocus required/>
				<label for="nom" class="formright">Nom</label>
				<input type ="text" name ="nom" placeholder="Votre nom" class="formright1" size="30" maxlength="10" required/>
			</p>
			<p>
				<label for="sexe">Sexe</label>
				<select name="sexe" id="sexe" class="formleft" required>
						<option value="Homme">Homme</option>
						<option value="Femme" selected>Femme</option>
						<option value="Autre">Autre</option>
				</select>
				<label for="date" class="formright">Date de naissance</label>
				<input type ="date" name ="date" placeholder="jj/mm/aa" class="formright1" size="30" maxlength="10" required/>
			</p>
			<p>
				<label for="profession">Profession</label>
				<select name="profession" id="profession" class="formleft" required>
						<option value="etudiant">Etudiant</option>
						<option value="enseignant" selected>Enseignant</option>
						<option value="professeur">Professeur</option>
				</select>
				<label for="domaine" class="formright">Domaine</label>
				<select name="domaine" id="domaine" class="formright1" required>
						<option value="Scientifique">Scientifique</option>
						<option value="Technique" selected>Technique</option>
						<option value="Pedagogique">Pédagogique</option>
				</select>
			</p>
			<p>
				<label for="email">E-mail</label>
				<input type ="email" name ="email" placeholder="Votre adresse e-mail"  class="formleft" size="30" maxlength="30" required/>
				<label for="email" class="formright">Téléphone</label>
				<select name="code" id="code" class="formright1" >
					<optgroup label="Afrique">
						<option value="RDC" selected>+243(RD Congo)</option>
						<option value="Ouganda">+256(Ouganda)</option>
					</optgroup>
					<optgroup label="Amérique">
						<option value="Canada">+1(Canada)</option>
						<option value="USA">+1(USA)</option>
						<option value="Bresil">+000(Brésil)</option>
					</optgroup>
					<optgroup label="Asie">
						<option value="Chine">+0000(Chine)</option>
						<option value="Inde">+0000(Inde)</option>
						<option value="Japon">+000(Japon)</option>
					</optgroup>
					<optgroup label="Europe">
						<option value="France">+33(France)</option>
						<option value="Allemagne">+0000(Allemagne)</option>
						<option value="Espagne">+000(Espagne)</option>
					</optgroup>
					<optgroup label="Océanie">
						<option value="Nouveau Zeland">+0000(Nouveau Zeland)</option>
						<option value="Australie">+0000(Australie)</option>
						<option value="Japon">+000(Japon)</option>
					</optgroup>					
				</select>
				<input type ="tel" name ="tel" placeholder="Votre N° de téléphone" class="tel" size="18" maxlength="10" required/>
			</p>
			<p>
				<label for="pass">Mot de passe</label>
				<input type ="password" class="formleft" name ="pass" placeholder="Votre mot de passe" id="pass" size="30" maxlength="30" required />
				<label for="pass" class="formright">Confirmez le mot de passe</label>
				<input type ="password" name ="pass" placeholder="Confirmez votre mot de passe" id="pass" class="formright1" size="30" maxlength="30" required />
			</p>
			<p>	<label for="pays">Pays</label>
				<select name="pays" id="pays" class="formleft">
					<optgroup label="Afrique">
						<option value="Afrique du sud">Afrique du sud</option>
						<option value="Algérie">Algérie</option>
						<option value="Egypte">Egypte</option>
					</optgroup>
					<optgroup label="Amérique">
						<option value="Canada">Canada</option>
						<option value="USA">USA</option>
						<option value="Bresil">Brésil</option>
					</optgroup>
					<optgroup label="Asie">
						<option value="Chine">Chine</option>
						<option value="Inde">Inde</option>
						<option value="Japon">Japon</option>
					</optgroup>
					<optgroup label="Europe">
						<option value="France">France</option>
						<option value="Allemagne">Allemagne</option>
						<option value="Espagne">Espagne</option>
					</optgroup>
					<optgroup label="Océanie">
						<option value="Nouveau Zeland">Nouveau Zeland</option>
						<option value="Australie">Australie</option>
						<option value="Autre">Autre</option>
					</optgroup>					
				</select>
				<label for="ville" class="formright">Ville/Région</label>
				<input type ="text" name ="ville" placeholder="Votre ville ou région"  class="formright1" size="30" maxlength="30" required/>
			</p>
			<p>
				<label for="forfait">Type d'abonnement</label>
				<select name="forfait" id="forfait" class="formleft" required>
						<option value="3 mois">3 mois pour 50$</option>
						<option value="6 mois" selected>6 mois pour 80$</option>
						<option value="1 an">1 an pour 140$</option>
						<option value="2 ans">2 ans pour 260$</option>
						<option value="3 ans">3 ans pour 380$</option>
				</select>
			</p>
			<p><strong>* Mode de paiement </strong></p>
			<p><strong> - Carte bancaire</strong></p>
			<p><a href="http://www.rawbank.com" alt="Rawbank"  title="Cliquez ici"><img src="logo/Rawbank.png" alt="logo Rawbank"></a> <a href="http://www.paypal.com" alt="Bleue"  title="Cliquez ici"><img src="logo/e.png" alt="logo Bleue"></a> <a href="http://www.paypal.com" alt="Paypal"  title="Cliquez ici"><img src="logo/pp.png" alt="logo Paypal"></a>  <a href="http://www.paypal.com" alt="Maestro"  title="Cliquez ici"><img src="logo/mst.png" alt="logo Maestro"></a>  <a href="http://www.paypal.com" alt="MasterCard"  title="Cliquez ici"><img src="logo/mstr.png" alt="logo MasterCard"></a>  <a href="http://www.paypal.com" alt="Visa"  title="Cliquez ici"><img src="logo/vs.png" alt="logo Visa"></a></p>
			<p><strong> - Mobile</strong></p>
			<p><a href="mpesa.php" alt="vodafone"  title="Cliquez ici"><img src="logo/mps.png" alt="logo m-pesa"></a> <a href="money.php" alt="airtel"  title="Cliquez ici"><img src="logo/airtel.jpg" alt="logo airtel money"></a>   <a href="orange.php" alt="Orange"  title="Cliquez ici"><img src="logo/orm.png" alt="logo Orange money"></a>  <a href="mtn.php" alt="MTN"  title="Cliquez ici"><img src="logo/mtn.png" alt="logo MTN money"></a></p>
			<p id="valide">
			<input type="submit" value="Enregistrer" id="enreg" />
			<a href="Actuabib.php" title="Retour arrière" id="retour"><input type="button" id="retour" value="Annuler" /></a>
			</p>
		</form>
		
	</body>
</html>
		





