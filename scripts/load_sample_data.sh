#!/usr/bin/env bash
# Load sample_data CSVs into the database. Run after migrations.
# Expects roles/permissions from seeds/001_rbac_seed.sql (npm run seed) — does not reload RBAC CSVs.
#
# Re-run after a previous seed:sample:
#   SAMPLE_DATA_REPLACE=1 bash scripts/load_sample_data.sh
#   bash scripts/load_sample_data.sh --replace
#   npm run seed:sample:replace
# Replace truncates sample tables (CASCADE may clear catalogue_items / focus rows tied to listings).
set -e
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Aborting."
  exit 1
fi

if ! echo "${DATABASE_URL}" | grep -qE 'localhost|127\.0\.0\.1'; then
  echo "Sample data is for local use only. DATABASE_URL does not point to localhost. Aborting."
  exit 1
fi

REPLACE=0
if [ "${1:-}" = "--replace" ] || [ "${SAMPLE_DATA_REPLACE:-}" = "1" ]; then
  REPLACE=1
fi

PSQL=(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1)

if [ "${REPLACE}" = "1" ]; then
  echo "Replace mode: truncating sample tables (CASCADE)..."
  "${PSQL[@]}" -f scripts/truncate_sample_data.sql
  echo "Replace mode: removing prior sample-sheet users..."
  "${PSQL[@]}" -f scripts/delete_sample_csv_users.sql
fi

echo "Loading warehouses..."
"${PSQL[@]}" -c "\\copy warehouses (id, name) FROM 'sample_data/01_warehouses.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading listings..."
"${PSQL[@]}" -c "\\copy listings (id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type, inventory_bypass_on, ops_tag, category, description, meta_fields, img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents, actual_weight, dimension, bulk_price, keyword_pool, material_info) FROM 'sample_data/02_listings.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading bins..."
"${PSQL[@]}" -c "\\copy bins (id, warehouse_id, sku_id, bin_id, available_quantity) FROM 'sample_data/03_bins.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading sku_analytics..."
"${PSQL[@]}" -c "\\copy sku_analytics (sku_id, inward_30d, inward_60d, inward_90d, outward_30d, outward_60d, outward_90d, fetched_at) FROM 'sample_data/04_sku_analytics.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading pack_combos..."
"${PSQL[@]}" -c "\\copy pack_combos (parent_sku_id, component_sku_id, quantity) FROM 'sample_data/05_pack_combos.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading warehouse_inventory_dump..."
"${PSQL[@]}" -c "\\copy warehouse_inventory_dump (warehouse_id, sku_id, inventory_operation_type, quantity, bin_id, user_id, created_at, updated_at) FROM 'sample_data/06_warehouse_inventory_dump.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading listing_order_details..."
"${PSQL[@]}" -c "\\copy listing_order_details (id, po_number, po_secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type, company_code_primary, company_code_secondary, demand, hsn_code, title, mrp, rate_without_tax, tax_rate, size, color, created_by, created_at, updated_at, dispatched_quantity, packed_quantity, company_name, delivery_city, po_issue_date, expiry_date, po_type, calculated_po_status) FROM 'sample_data/07_listing_order_details.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading inbound_summary..."
"${PSQL[@]}" -c "\\copy inbound_summary (sku_id, summary_date, quantity, source, fetched_at) FROM 'sample_data/08_inbound_summary.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading incoming_quantity..."
"${PSQL[@]}" -c "\\copy incoming_quantity (sku_id, quantity, expected_date, source, fetched_at) FROM 'sample_data/09_incoming_quantity.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading secondary_listings..."
"${PSQL[@]}" -c "\\copy secondary_listings (id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type, inventory_bypass_status, ais_quantity, available_quantity) FROM 'sample_data/10_secondary_listings.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading vendors..."
"${PSQL[@]}" -c "\\copy vendors (id, vendor_name, vendor_address_line, vendor_city, vendor_state, vendor_postal_code, vendor_gstin, vendor_contact_number) FROM 'sample_data/11_vendors.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading vendor_specialties..."
"${PSQL[@]}" -c "\\copy vendor_specialties (id, vendor_id, vendor_speciality) FROM 'sample_data/12_vendor_specialties.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading vendor_sku..."
"${PSQL[@]}" -c "\\copy vendor_sku (id, vendor_id, sku_id, cost_price, modified_by) FROM 'sample_data/13_vendor_sku.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading users..."
"${PSQL[@]}" -c "\\copy users (email) FROM 'sample_data/14_users.csv' WITH (FORMAT csv, HEADER true)"

echo "Assigning sample user roles (by email)..."
"${PSQL[@]}" -f scripts/sample_user_roles_from_csv_emails.sql

echo "Loading forms..."
"${PSQL[@]}" -c "\\copy forms (category, sub_category, form_name, form_payload, created_by, is_active, version) FROM 'sample_data/19_forms.csv' WITH (FORMAT csv, HEADER true)"

echo "Loading form_submissions..."
"${PSQL[@]}" -c "\\copy form_submissions (form_id, user_id, submission_date, payload) FROM 'sample_data/20_form_submissions.csv' WITH (FORMAT csv, HEADER true)"

echo "Done."
