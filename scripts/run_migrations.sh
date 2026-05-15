#!/usr/bin/env bash
# Create database (if missing) and run migrations 001-064 in order.
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
         migrations/033_inbound_pending_debit_credit_notes.sql \
         migrations/034_secondary_listings_eautomate_enrichment.sql \
         migrations/035_listings_eautomate_bins.sql \
         migrations/036_outbound_sold_via_and_po_attachments.sql \
         migrations/037_outbound_po_eautomate_sync_meta.sql \
         migrations/038_outbound_po_eautomate_files.sql \
         migrations/039_outbound_consignments.sql \
         migrations/040_outbound_po_listings_snapshot.sql \
         migrations/041_company_secondary_sku_code_primary.sql \
         migrations/042_zap_file_storage_paths.sql \
         migrations/043_outbound_consignment_details.sql \
         migrations/044_outbound_po_logs.sql \
         migrations/045_business_roles_and_permissions.sql \
         migrations/046_create_sku_tags.sql \
         migrations/047_reorder_system.sql \
         migrations/048_sheets_sync_log.sql \
         migrations/049_grn_debit_notes.sql \
         migrations/050_grn_accounts_and_inventory.sql \
         migrations/051_secondary_listings_logs.sql \
         migrations/052_secondary_listings_manage_permission.sql \
         migrations/053_grn_close_and_dn_enhancements.sql \
         migrations/054_grn_grn_id_on_update_cascade.sql \
         migrations/055_inbound_zap_debit_notes_status_include_closed.sql \
         migrations/056_inbound_grn_logs_log_id_seq.sql \
         migrations/057_grn_receipt_exception.sql \
         migrations/058_user_dashboard_prefs.sql \
         migrations/059_vendor_purchase_orders_source.sql \
         migrations/060_inbound_grns_source.sql \
         migrations/061_bins_manage_permission.sql \
         migrations/062_bins_id_sequence.sql \
         migrations/063_debit_note_lines_rejected_short_qty.sql \
         migrations/064_outbound_consignments_zap_source.sql; do
  if [ -f "$f" ]; then
    echo "  $f"
    psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "$f"
  else
    echo "  Missing: $f" >&2
    exit 1
  fi
done

echo "Migrations done."
