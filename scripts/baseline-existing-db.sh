#!/usr/bin/env bash
set -euo pipefail

mode="dry-run"
if [[ "${1:-}" == "--execute" ]]; then mode="execute"; shift; fi
if [[ $# -ne 0 ]]; then echo "Usage: $0 [--execute]" >&2; exit 2; fi

echo "Mode: ${mode} (aucune commande destructive n'est utilisée)"
echo "1. Sauvegarde PostgreSQL: pg_dump --format=custom --file=<backup>.dump <DATABASE_URL>"
echo "2. Schéma réel: npx prisma db pull --print"
echo "3. Écart: npx prisma migrate diff --from-url <DATABASE_URL> --to-migrations prisma/migrations --script"
echo "4. Après revue humaine d'un écart vide/attendu: npx prisma migrate resolve --applied <migration>"

if [[ "$mode" == "dry-run" ]]; then
  echo "Dry-run terminé. Relancer avec --execute après lecture de docs/production-readiness.md."
  exit 0
fi

: "${DATABASE_URL:?DATABASE_URL est requise}"
: "${BASELINE_MIGRATIONS:?Liste CSV explicite requise, ex: 0_init}"
backup_dir="${BASELINE_BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
backup_file="${backup_dir}/bicuni-baseline-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --file="$backup_file" "$DATABASE_URL"
echo "Sauvegarde créée: $backup_file"
npx prisma db pull --print
npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --script
IFS=',' read -r -a migrations <<< "$BASELINE_MIGRATIONS"
for migration in "${migrations[@]}"; do
  [[ "$migration" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Nom de migration invalide" >&2; exit 2; }
  npx prisma migrate resolve --applied "$migration"
done
npx prisma migrate status
echo "Baseline enregistrée. Conserver la sauvegarde jusqu'à validation applicative."
