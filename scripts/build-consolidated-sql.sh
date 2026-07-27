#!/usr/bin/env bash
# Concatena todas as migrations (em ordem) em um único arquivo SQL, para
# quem prefere colar direto no SQL Editor do Supabase em vez de usar o
# Supabase CLI. Rode sempre que uma nova migration for adicionada:
#   ./scripts/build-consolidated-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="supabase/consolidated.sql"
{
  echo "-- ============================================================================"
  echo "-- ARQUIVO GERADO — não editar à mão."
  echo "-- Gerado por scripts/build-consolidated-sql.sh a partir de supabase/migrations/*.sql"
  echo "-- Cole este arquivo inteiro no SQL Editor do Supabase (Dashboard → SQL Editor)"
  echo "-- e rode uma única vez, na ordem que está aqui."
  echo "-- ============================================================================"
  echo
  for f in supabase/migrations/*.sql; do
    echo "-- ---------------------------------------------------------------------------"
    echo "-- $(basename "$f")"
    echo "-- ---------------------------------------------------------------------------"
    cat "$f"
    echo
  done
} > "$OUT"

echo "Gerado: $OUT ($(wc -l < "$OUT") linhas)"
