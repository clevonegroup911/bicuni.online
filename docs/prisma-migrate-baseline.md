# Baseline Prisma Migrate sans perte de données

La base locale actuelle a été créée avec `prisma db push`. Le schéma PostgreSQL et
`prisma/schema.prisma` sont alignés, mais aucune migration n'est enregistrée.

Ne jamais exécuter `prisma migrate reset` sur une base contenant des données.

## Procédure contrôlée

1. Sauvegarder la base avec `pg_dump` et vérifier que la sauvegarde peut être restaurée.
2. Cloner la base dans une instance PostgreSQL temporaire.
3. Créer `prisma/migrations/0_init/migration.sql` avec :

   ```bash
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script
   ```

4. Examiner le SQL généré. Il doit uniquement représenter le schéma existant.
5. Sur le clone uniquement, marquer le baseline comme déjà appliqué :

   ```bash
   npx prisma migrate resolve --applied 0_init
   npx prisma migrate status
   ```

6. Comparer le clone et le schéma Prisma avec `prisma migrate diff`; le résultat doit
   être `No difference detected`.
7. Après validation et sauvegarde, exécuter seulement `migrate resolve --applied
   0_init` sur la base existante. Cette commande enregistre le baseline sans rejouer
   les `CREATE TABLE`.
8. Pour les changements ultérieurs, générer les migrations en développement avec
   `prisma migrate dev`, puis utiliser `prisma migrate deploy` en déploiement.

Les fonctions et triggers SQL de l'outbox de recherche ne font pas partie du schéma
Prisma. Le script `npm run search:outbox` doit rester une étape explicite et
idempotente du déploiement, ou être intégré à une migration SQL relue.
