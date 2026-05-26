-- Derived rollup for Ops SKU PO Control (read from existing outbound/inbound/listings tables only).

CREATE TABLE IF NOT EXISTS ops_master_sku_po_metrics (
    master_sku               TEXT PRIMARY KEY,
    open_actual_po_qty       INT NOT NULL DEFAULT 0,
    open_po_qty_sent         INT NOT NULL DEFAULT 0,
    total_pending            INT NOT NULL DEFAULT 0,
    open_po_fill_rate_pct    NUMERIC(8, 2),
    order_placed_by_ops      INT NOT NULL DEFAULT 0,
    app_stock                INT NOT NULL DEFAULT 0,
    order_place_pending      INT NOT NULL DEFAULT 0,
    computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_sync_watermark    TIMESTAMPTZ,
    meta                     JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE ops_master_sku_po_metrics IS
  'Cached master-SKU PO control metrics; refreshed via npm run refresh:ops-sku-po-metrics (no eAutomate calls).';

CREATE INDEX IF NOT EXISTS idx_ops_master_sku_po_metrics_total_pending
    ON ops_master_sku_po_metrics (total_pending DESC);

CREATE INDEX IF NOT EXISTS idx_ops_master_sku_po_metrics_order_place_pending
    ON ops_master_sku_po_metrics (order_place_pending DESC);
