#!/usr/bin/env bash
#
# sync-all-eautomate.sh — run all eAutomate → PostgreSQL sync npm scripts in dependency order.
#
# Docs: docs/sync-all-eautomate.md
# Quick: npm run sync:eautomate:all
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
CONTINUE_ON_ERROR=0
SKIP_VENDOR_DETAILS=0
SKIP_VENDOR_POS=0
SKIP_GRNS=0
SKIP_GRNS_PENDING=0
SKIP_SECONDARY=0
SKIP_OUTBOUND=0
SKIP_PO_DETAILS=0
SKIP_GRN_DETAILS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --continue-on-error) CONTINUE_ON_ERROR=1 ;;
    --skip-vendor-details) SKIP_VENDOR_DETAILS=1 ;;
    --skip-vendor-pos) SKIP_VENDOR_POS=1 ;;
    --skip-grns) SKIP_GRNS=1 ;;
    --skip-grns-pending) SKIP_GRNS_PENDING=1 ;;
    --skip-secondary) SKIP_SECONDARY=1 ;;
    --skip-outbound) SKIP_OUTBOUND=1 ;;
    --skip-po-details) SKIP_PO_DETAILS=1 ;;
    --skip-grn-details) SKIP_GRN_DETAILS=1 ;;
    --help|-h)
      cat <<'EOF'
eAutomate master sync — runs npm sync scripts from web/ in order.

Usage:
  bash scripts/sync-all-eautomate.sh [options]
  npm run sync:eautomate:all -- [options]

Options:
  --dry-run              Print npm commands only
  --continue-on-error    Log failures and continue (also passes --continue-on-error
                         to sync:vendors:detail-all and sync:grn:details:all)
  --skip-vendor-details  Skip sync:vendors:detail-all (very large: every vendor)
  --skip-vendor-pos      Skip sync:vendor-pos:all
  --skip-grns            Skip sync:grns:all
  --skip-grns-pending    Skip pending-audit / invoice / debit-credit GRN syncs
  --skip-secondary       Skip sync:secondary-listings
  --skip-outbound        Skip companies + partial POs + consignments
  --skip-po-details      Skip sync:po:details:from-db
  --skip-grn-details     Skip sync:grn:details:all

Environment (see .env.local.example):
  DATABASE_URL (required)
  EAUTOMATE_COOKIE or EAUTOMATE_BEARER_TOKEN (usually required for protected APIs)
  EAUTOMATE_BASE_URL (optional)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
  shift
done

log() { printf '\n\033[1m[%s]\033[0m %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

run_npm() {
  local name="$1"
  shift
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN: npm run ${name} -- $*"
    return 0
  fi
  log "Running: npm run ${name} -- $*"
  if [[ "$CONTINUE_ON_ERROR" -eq 1 ]]; then
    set +e
    npm run "$name" -- "$@"
    local code=$?
    set -e
    if [[ "$code" -ne 0 ]]; then
      log "WARNING: npm run ${name} exited ${code} (continuing)"
    fi
    return 0
  fi
  npm run "$name" -- "$@"
}

preflight() {
  node -e "
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
  console.error('DATABASE_URL is not set. Configure web/.env.local or export DATABASE_URL.');
  process.exit(1);
}
const c = process.env.EAUTOMATE_COOKIE;
const t = process.env.EAUTOMATE_BEARER_TOKEN;
const login =
  process.env.EAUTOMATE_LOGIN_USER_ID?.trim() && process.env.EAUTOMATE_LOGIN_PASSWORD;
if (!c && !t && !login) {
  console.warn('No eAutomate auth: set EAUTOMATE_COOKIE / EAUTOMATE_BEARER_TOKEN or EAUTOMATE_LOGIN_USER_ID + EAUTOMATE_LOGIN_PASSWORD.');
}
" || exit 1
}

preflight

VENDOR_EXTRA=()
[[ "$CONTINUE_ON_ERROR" -eq 1 ]] && VENDOR_EXTRA+=(--continue-on-error)

GRN_EXTRA=()
[[ "$CONTINUE_ON_ERROR" -eq 1 ]] && GRN_EXTRA+=(--continue-on-error)

log "=== eAutomate full sync (web: $ROOT) ==="
[[ "$DRY_RUN" -eq 1 ]] && log "Dry run — no commands executed."

log "Phase 1: vendor master list"
run_npm sync:vendors:all

if [[ "$SKIP_VENDOR_DETAILS" -eq 0 ]]; then
  log "Phase 1b: per-vendor listings (warehouses, listings, bins, SKU names cache)"
  if [[ ${#VENDOR_EXTRA[@]} -gt 0 ]]; then
    run_npm sync:vendors:detail-all "${VENDOR_EXTRA[@]}"
  else
    run_npm sync:vendors:detail-all
  fi
else
  log "Skipping sync:vendors:detail-all (--skip-vendor-details)"
fi

log "Phase 2: inbound PO headers & GRN index"
if [[ "$SKIP_VENDOR_POS" -eq 0 ]]; then
  run_npm sync:vendor-pos:all
else
  log "Skipping sync:vendor-pos:all"
fi

if [[ "$SKIP_GRNS" -eq 0 ]]; then
  run_npm sync:grns:all
else
  log "Skipping sync:grns:all"
fi

if [[ "$SKIP_GRNS_PENDING" -eq 0 ]]; then
  log "Phase 2b: GRN pending queues"
  run_npm sync:grns:pending-audit
  run_npm sync:grns:pending-invoice-collection
  run_npm sync:grns:pending-debit-credit
else
  log "Skipping GRN pending syncs (--skip-grns-pending)"
fi

if [[ "$SKIP_SECONDARY" -eq 0 ]]; then
  log "Phase 3: secondary listings"
  run_npm sync:secondary-listings
else
  log "Skipping sync:secondary-listings"
fi

if [[ "$SKIP_OUTBOUND" -eq 0 ]]; then
  log "Phase 4: outbound"
  run_npm sync:outbound-companies
  run_npm sync:outbound-partial-pos
  run_npm sync:outbound-consignments
else
  log "Skipping outbound phase"
fi

if [[ "$SKIP_PO_DETAILS" -eq 0 ]]; then
  if [[ "$SKIP_VENDOR_POS" -eq 0 ]]; then
    log "Phase 5a: PO detail ingest (uses vendor_purchase_orders)"
    run_npm sync:po:details:from-db
  else
    log "Skipping sync:po:details:from-db (vendor PO list was skipped)"
  fi
else
  log "Skipping sync:po:details:from-db"
fi

if [[ "$SKIP_GRN_DETAILS" -eq 0 ]]; then
  log "Phase 5b: GRN deep ingest (uses inbound_grns)"
  if [[ ${#GRN_EXTRA[@]} -gt 0 ]]; then
    run_npm sync:grn:details:all "${GRN_EXTRA[@]}"
  else
    run_npm sync:grn:details:all
  fi
else
  log "Skipping sync:grn:details:all"
fi

log "=== eAutomate full sync finished ==="
