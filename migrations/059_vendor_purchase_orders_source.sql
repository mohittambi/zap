-- Distinguish zap-created POs from eAutomate-synced POs so the detail-ingest
-- and display layers can short-circuit eAutomate calls / snapshot rows for
-- zap-only POs. Existing rows default to 'eautomate'; the cleanup script
-- (scripts/fix-zap-pos.mjs) flips known zap-created POs.

ALTER TABLE vendor_purchase_orders
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'eautomate'
  CHECK (source IN ('zap', 'eautomate'));

CREATE INDEX IF NOT EXISTS idx_vendor_po_source ON vendor_purchase_orders (source);

-- Zap-created POs use a high range (10^10+) so they cannot collide with
-- eAutomate's id space. Existing zap rows keep their old ids; only future
-- rows pull from this sequence.
CREATE SEQUENCE IF NOT EXISTS vendor_purchase_orders_zap_id_seq
  AS BIGINT START WITH 10000000001 INCREMENT BY 1 NO MAXVALUE;
