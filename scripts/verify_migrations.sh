#!/usr/bin/env bash
# Ensure every migrations/*.sql file is listed in run_migrations.sh (and vice versa).
# With --db and DATABASE_URL set, also verify security migration 070 schema objects exist.
set -e
cd "$(dirname "$0")/.."

RUNNER="scripts/run_migrations.sh"
CHECK_DB=false
for arg in "$@"; do
  case "$arg" in
    --db) CHECK_DB=true ;;
    -h|--help)
      echo "Usage: bash scripts/verify_migrations.sh [--db]"
      echo "  (default) Compare migrations/ files vs run_migrations.sh registry."
      echo "  --db      Also verify migration 070 security objects in DATABASE_URL."
      exit 0
      ;;
  esac
done

if [ ! -f "$RUNNER" ]; then
  echo "Missing $RUNNER" >&2
  exit 1
fi

DISK_LIST=$(mktemp)
RUNNER_LIST=$(mktemp)
trap 'rm -f "$DISK_LIST" "$RUNNER_LIST"' EXIT

find migrations -maxdepth 1 -name '[0-9]*.sql' | sort > "$DISK_LIST"
grep -oE 'migrations/[0-9]+_[^ ]+\.sql' "$RUNNER" | sort > "$RUNNER_LIST"

missing_from_runner=$(comm -23 "$DISK_LIST" "$RUNNER_LIST" || true)
orphan_in_runner=$(comm -13 "$DISK_LIST" "$RUNNER_LIST" || true)

if [ -n "$missing_from_runner" ] || [ -n "$orphan_in_runner" ]; then
  echo "Migration registry mismatch." >&2
  if [ -n "$missing_from_runner" ]; then
    echo "  On disk but not in $RUNNER:" >&2
    echo "$missing_from_runner" | sed 's/^/    /' >&2
  fi
  if [ -n "$orphan_in_runner" ]; then
    echo "  Listed in $RUNNER but file missing:" >&2
    echo "$orphan_in_runner" | sed 's/^/    /' >&2
  fi
  exit 1
fi

count=$(wc -l < "$DISK_LIST" | tr -d ' ')
last=$(tail -n 1 "$DISK_LIST")
echo "Migration registry OK: $count files (latest: $last)"

if [ "$CHECK_DB" = false ]; then
  exit 0
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; skipping DB schema checks." >&2
  exit 0
fi

result=$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -At -c "
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_audit_log'
  ) THEN 'missing table admin_audit_log'
  WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'api_key_prefix'
  ) THEN 'missing column users.api_key_prefix'
  WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'token_invalidated_at'
  ) THEN 'missing column users.token_invalidated_at'
  WHEN NOT EXISTS (
    SELECT 1 FROM permissions
    WHERE resource = 'query_builder' AND action = 'read'
  ) THEN 'missing permission query_builder:read'
  ELSE 'ok'
END;
")

if [ "$result" != "ok" ]; then
  echo "Migration 070 security schema check failed: $result" >&2
  echo "Run: npm run migrate" >&2
  exit 1
fi

echo "Migration 070 security schema OK."
