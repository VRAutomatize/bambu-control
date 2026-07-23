#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Valida migrations + RLS contra um Postgres local (sem Supabase CLI/Docker).
# Uso: scripts/db-test.sh  (requer psql; inicia um cluster efêmero se preciso)
#
# Em CI/produção prefira `supabase db reset` (aplica migrations + seed no
# Postgres do Supabase). Este script existe para validar SQL localmente rápido.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGHOST_DIR="${PGHOST_DIR:-/tmp}"
PGPORT="${PGPORT:-55432}"
PSQL=(psql -h "$PGHOST_DIR" -p "$PGPORT" -U postgres)

echo "==> Recriando banco de teste 'bambu'"
"${PSQL[@]}" -d postgres -q -c "drop database if exists bambu;" -c "create database bambu;"

echo "==> Aplicando shim de auth (apenas teste local)"
"${PSQL[@]}" -d bambu -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/_auth_shim.sql"

echo "==> Aplicando migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -d bambu -q -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> Rodando testes de RLS"
"${PSQL[@]}" -d bambu -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/rls_test.sql"

echo "==> OK"
