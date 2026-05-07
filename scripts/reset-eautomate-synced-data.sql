-- Clears operational rows populated by eAutomate sync (master script + detail phases).
-- Also truncates inbound_grn_logs (Zap-written GRN activity; it is not re-synced from eAutomate).
-- Keeps: users, RBAC, forms, form_submissions, outbound_sold_via (reference seed).
-- Truncates catalogue_items / focus_list_items that FK listings (CASCADE from listings).
--
-- Run only when pointed at the DB you intend to wipe (e.g. Supabase Postgres).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reset-eautomate-synced-data.sql

BEGIN;

TRUNCATE TABLE
  outbound_po_eautomate_files,
  outbound_po_attachments,
  outbound_consignments,
  outbound_consignment_delivery_locations,
  outbound_purchase_orders,
  delivery_locations,
  company_secondary_sku,
  companies,
  inbound_grn_debit_credit_note_files,
  inbound_grn_debit_credit_notes,
  inbound_po_detail_lines,
  inbound_po_detail_grns,
  inbound_po_detail_snapshot,
  inbound_grn_invoice_files,
  inbound_grn_added_items,
  inbound_grn_items,
  inbound_grn_detail_snapshot,
  inbound_grn_logs,
  inbound_pending_debit_credit_notes,
  inbound_grn_pending_audit,
  inbound_grn_pending_invoice_collection,
  inbound_grns,
  vendor_purchase_order_lines,
  vendor_purchase_orders,
  eautomate_sku_names_cache,
  labels_master_data,
  listing_embeddings,
  listing_order_details,
  warehouse_inventory_dump,
  pack_combos,
  sku_analytics,
  bins,
  inbound_summary,
  incoming_quantity,
  secondary_listings,
  vendor_sku,
  vendor_specialties,
  vendors,
  catalogue_items,
  focus_list_items,
  listings,
  warehouses
RESTART IDENTITY CASCADE;

COMMIT;
