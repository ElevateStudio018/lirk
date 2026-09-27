#!/usr/bin/env bash
# Regenerates src/lib/supabase/database.types.ts from supabase/migrations.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="lirk_types_$$"
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/supabase-shim.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
npx tsx scripts/gen-db-types.ts "$DB"
