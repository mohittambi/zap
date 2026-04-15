-- Cached eAutomate GET .../incoming_purchase_orders/listings/paginated/{po_number} for outbound PO detail UI

ALTER TABLE outbound_purchase_orders
  ADD COLUMN IF NOT EXISTS listings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN outbound_purchase_orders.listings_snapshot IS
  'Snapshot from eAutomate listings/paginated for this PO (total, content[], etc.).';
