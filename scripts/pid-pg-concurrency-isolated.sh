#!/usr/bin/env bash
# Throwaway initdb cluster only. Never migrate, never use the application database.
set -euo pipefail
cd "$(dirname "$0")/.."

unset DATABASE_URL
unset DIRECT_URL
unset PGHOST
unset PGPORT
unset PGUSER
unset PGPASSWORD
unset PGDATABASE
unset PGSERVICE
unset PGSERVICEFILE
unset PGPASSFILE

exec npx tsx scripts/pid-pg-concurrency-isolated.ts
