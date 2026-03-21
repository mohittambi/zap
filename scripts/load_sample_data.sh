#!/usr/bin/env bash
# Load sample_data CSVs into the database. Run after migrations. Local use only.
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

FILES="01_warehouses 02_listings 03_bins 04_sku_analytics 05_pack_combos 06_warehouse_inventory_dump 07_listing_order_details 08_inbound_summary 09_incoming_quantity 10_secondary_listings 11_vendors 12_vendor_specialties 13_vendor_sku 14_users 15_roles 16_permissions 17_role_permissions 18_user_roles 19_forms 20_form_submissions"
for f in $FILES; do
  table=$(echo "$f" | sed 's/^[0-9]*_//')
  echo "Loading $table..."
  psql "${DATABASE_URL}" -c "\\copy $table FROM 'sample_data/${f}.csv' WITH (FORMAT csv, HEADER true)"
done
echo "Done."
