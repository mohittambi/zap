-- Outbound POs: preserve full eAutomate payload on sync + index for partial list

ALTER TABLE outbound_purchase_orders
  ADD COLUMN IF NOT EXISTS eautomate_raw JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE outbound_purchase_orders
  ADD COLUMN IF NOT EXISTS eautomate_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outbound_po_po_creation_status
  ON outbound_purchase_orders (po_creation_status);

CREATE INDEX IF NOT EXISTS idx_outbound_po_eautomate_synced_at
  ON outbound_purchase_orders (eautomate_synced_at DESC NULLS LAST);
