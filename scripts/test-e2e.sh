#!/usr/bin/env bash
# End-to-end test of the service layer: real PostgreSQL + RLS through PostgREST
# (the same REST layer Supabase uses). Only the LLM is replaced by fixtures that
# must pass the production schemas and validators.
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run test:e2e
set -euo pipefail
cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
DB="lirk_e2e_$$"
PGRST_PORT="${PGRST_PORT:-54331}"
BIN_DIR="node_modules/.cache/postgrest"
BIN="$BIN_DIR/postgrest"
if [ ! -x "$BIN" ]; then
  mkdir -p "$BIN_DIR"
  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ -C "$BIN_DIR"
fi

createdb "$DB"
cleanup() {
  [ -n "${PGRST_PID:-}" ] && kill "$PGRST_PID" 2>/dev/null || true
  dropdb --if-exists "$DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PSQL=(psql -v ON_ERROR_STOP=1 -q -d "$DB")
"${PSQL[@]}" -f supabase/tests/supabase-shim.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if; end \$\$; grant anon, authenticated to authenticator;"

export E2E_JWT_SECRET="e2e-secret-that-is-at-least-32-characters-long"
PGRST_DB_URI="postgres://authenticator@/$DB?host=$PGHOST&port=$PGPORT" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$E2E_JWT_SECRET" \
PGRST_SERVER_PORT="$PGRST_PORT" PGRST_LOG_LEVEL=crit "$BIN" &
PGRST_PID=$!
for _ in $(seq 1 50); do curl -s "http://127.0.0.1:$PGRST_PORT/" >/dev/null && break; sleep 0.2; done

E2E_DB="$DB" E2E_POSTGREST="http://127.0.0.1:$PGRST_PORT" npx vitest run --config vitest.e2e.config.mts
