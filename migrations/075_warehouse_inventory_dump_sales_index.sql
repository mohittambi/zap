-- Speeds up sales aggregations over warehouse_inventory_dump.
-- The decision-intelligence services (segmentation, working capital, forecast)
-- plus homeSummaryService and reorderService all scan REMOVE rows by a
-- created_at time window and GROUP BY sku_id. With only the separate
-- (sku_id) and (created_at) indexes, concurrent 90-day aggregations on a
-- large dump table exceed statement_timeout (observed on /insights pages).
--
-- This partial, covering index lets those queries do a range scan on
-- created_at, grouped by sku_id, with quantity + movement_type available
-- without a heap fetch.
CREATE INDEX IF NOT EXISTS idx_wid_remove_created_sku
  ON warehouse_inventory_dump (created_at, sku_id)
  INCLUDE (quantity, movement_type)
  WHERE inventory_operation_type = 'REMOVE';
