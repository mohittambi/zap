#!/usr/bin/env bash
# Run a seed SQL file only when DATABASE_URL points to localhost.
# Usage: run_seed_local.sh <path-to-seed.sql>
set -e
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Aborting."
  exit 1
fi

if ! echo "${DATABASE_URL}" | grep -qE 'localhost|127\.0\.0\.1'; then
  echo "Seeds are for local use only. DATABASE_URL does not point to localhost. Aborting."
  exit 1
fi

if [ -z "$1" ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <path-to-seed.sql>"
  exit 1
fi

psql "${DATABASE_URL}" -f "$1"
