-- Reorder alert system
-- 1. movement_type on warehouse_inventory_dump distinguishes SALE from TRANSFER / ADJUSTMENT
-- 2. sku_reorder_config stores per-SKU lead time and formula preference

ALTER TABLE warehouse_inventory_dump
  ADD COLUMN IF NOT EXISTS movement_type VARCHAR(30) DEFAULT 'SALE';

COMMENT ON COLUMN warehouse_inventory_dump.movement_type IS
  'SALE | TRANSFER_IN | TRANSFER_OUT | ADJUSTMENT_IN | ADJUSTMENT_OUT';

-- Back-fill: treat every existing REMOVE as a SALE, every ADD as ADJUSTMENT_IN
UPDATE warehouse_inventory_dump
   SET movement_type = CASE
     WHEN inventory_operation_type = 'REMOVE' THEN 'SALE'
     ELSE 'ADJUSTMENT_IN'
   END
 WHERE movement_type IS NULL OR movement_type = 'SALE' AND inventory_operation_type = 'ADD';

CREATE INDEX IF NOT EXISTS idx_wid_movement_type
  ON warehouse_inventory_dump (movement_type, created_at DESC);

-- Per-SKU reorder configuration
CREATE TABLE IF NOT EXISTS sku_reorder_config (
  sku_id         VARCHAR(100) PRIMARY KEY REFERENCES listings(sku_id) ON DELETE CASCADE,
  lead_time_days INT          NOT NULL DEFAULT 7,
  use_advanced   BOOLEAN      NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
