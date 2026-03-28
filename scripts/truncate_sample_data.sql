-- Clears tables populated by load_sample_data.sh so the load can be re-run.
-- Uses CASCADE so tables that reference listings (e.g. catalogue_items, focus_list_items, listing_embeddings) are cleared too.
-- Run only against local dev DB.

TRUNCATE TABLE
  form_submissions,
  forms,
  warehouse_inventory_dump,
  pack_combos,
  sku_analytics,
  bins,
  inbound_summary,
  incoming_quantity,
  listing_order_details,
  secondary_listings,
  vendor_purchase_order_lines,
  vendor_purchase_orders,
  vendor_sku,
  vendor_specialties,
  vendors,
  listings,
  warehouses
RESTART IDENTITY CASCADE;
