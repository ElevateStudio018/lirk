#!/usr/bin/env bash
# Runs all migrations and the RLS test-suite against a throwaway database on a
# plain PostgreSQL server, using a small Supabase shim (auth.uid(), roles, storage).
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

DB="lirk_test_$$"
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"

createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

PSQL=(psql -v ON_ERROR_STOP=1 -q -d "$DB")
"${PSQL[@]}" -f supabase/tests/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  echo "migrating: $f"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f supabase/tests/rls.test.sql
