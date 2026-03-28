#!/usr/bin/env bash
# Create database (if missing) and run migrations 001-033 in order.
# Requires DATABASE_URL (e.g. from .env). Use: npm run migrate
#
# Migrations use CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS so
# re-running is safe: already-applied steps no-op; remaining steps apply.
set -e
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Set it in .env or the environment."
  exit 1
fi

# Extract database name and build connection string to 'postgres' for CREATE DATABASE
DBNAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^/?]*\)$|\1|p')
if [ -z "$DBNAME" ]; then
  echo "Could not parse database name from DATABASE_URL."
  exit 1
fi
if ! [[ "$DBNAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "Database name must be alphanumeric (and underscore). Got: $DBNAME"
  exit 1
fi

BASE_URL=$(echo "$DATABASE_URL" | sed 's|[^/]*$||')
POSTGRES_URL="${BASE_URL}postgres"

echo "Creating database '$DBNAME' if it does not exist..."
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = '$DBNAME'" | grep -q 1 \
  || psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DBNAME\";"

echo "Running migrations..."
for f in migrations/001_create_warehouses.sql \
         migrations/002_create_listings.sql \
         migrations/003_create_bins.sql \
         migrations/004_create_sku_analytics.sql \
         migrations/005_create_pack_combos.sql \
         migrations/006_create_listing_embeddings.sql \
         migrations/007_create_warehouse_inventory_dump.sql \
         migrations/008_create_vendors.sql \
         migrations/009_create_purchase_orders.sql \
         migrations/010_create_inbound_summary.sql \
         migrations/011_create_incoming_quantity.sql \
         migrations/012_create_secondary_listings.sql \
         migrations/013_create_users.sql \
         migrations/014_create_rbac.sql \
         migrations/015_create_forms.sql \
         migrations/016_create_form_submissions.sql \
         migrations/017_create_companies_and_company_secondary_sku.sql \
         migrations/018_create_labels_master_data.sql \
         migrations/019_create_focus_lists.sql \
         migrations/020_create_catalogues.sql \
         migrations/021_outbound_purchase_orders.sql \
         migrations/022_vendors_inbound_permissions.sql \
         migrations/023_vendor_purchase_orders.sql \
         migrations/024_inbound_po_permissions.sql \
         migrations/025_inbound_grns.sql \
         migrations/026_inbound_grn_pending_audit_queue.sql \
         migrations/027_inbound_grn_pending_invoice_collection_queue.sql \
         migrations/028_inbound_grn_details.sql \
         migrations/029_inbound_po_details.sql \
         migrations/030_eautomate_sku_names_cache.sql \
         migrations/031_inbound_grn_documents.sql \
         migrations/032_inbound_grn_logs.sql \
         migrations/033_inbound_pending_debit_credit_notes.sql; do
  if [ -f "$f" ]; then
    echo "  $f"
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "$f"
  else
    echo "  Missing: $f" >&2
    exit 1
  fi
done

echo "Migrations done."
