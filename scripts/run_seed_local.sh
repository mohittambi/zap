#!/usr/bin/env bash
# Run a seed SQL file. By default only when DATABASE_URL points to localhost.
# To apply seeds to a remote DB (e.g. Supabase), set ZAP_ALLOW_REMOTE_SEED=1 intentionally.
# Usage: run_seed_local.sh <path-to-seed.sql>
set -e
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Aborting."
  exit 1
fi

if ! echo "${DATABASE_URL}" | grep -qE 'localhost|127\.0\.0\.1'; then
  if [ "${ZAP_ALLOW_REMOTE_SEED:-}" != "1" ]; then
    echo "Seeds default to local Postgres only. DATABASE_URL does not point to localhost."
    echo "To seed a remote database (e.g. Supabase), run: ZAP_ALLOW_REMOTE_SEED=1 npm run seed"
    echo "(or export ZAP_ALLOW_REMOTE_SEED=1 for seed:forms, seed:zap, etc.)"
    exit 1
  fi
  echo "WARNING: ZAP_ALLOW_REMOTE_SEED=1 — executing seed against non-local DATABASE_URL"
fi

if [ -z "$1" ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <path-to-seed.sql>"
  exit 1
fi

psql "${DATABASE_URL}" -f "$1"
