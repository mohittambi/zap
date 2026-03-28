-- PO detail snapshot (eautomate: vendor, listings, sku names, PO, lines, GRNs by PO)

CREATE TABLE IF NOT EXISTS inbound_po_detail_snapshot (
    po_id BIGINT PRIMARY KEY,
    vendor_id BIGINT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vendor_raw JSONB NOT NULL DEFAULT '{}',
    vendor_listings_raw JSONB NOT NULL DEFAULT '[]',
    sku_names_raw JSONB NOT NULL DEFAULT '[]',
    po_raw JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_inbound_po_detail_snapshot_vendor
    ON inbound_po_detail_snapshot (vendor_id);

CREATE TABLE IF NOT EXISTS inbound_po_detail_lines (
    po_id BIGINT NOT NULL REFERENCES inbound_po_detail_snapshot (po_id) ON DELETE CASCADE,
    line_index INT NOT NULL,
    sku_id VARCHAR(100),
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (po_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_inbound_po_detail_lines_sku
    ON inbound_po_detail_lines (sku_id);

CREATE TABLE IF NOT EXISTS inbound_po_detail_grns (
    po_id BIGINT NOT NULL REFERENCES inbound_po_detail_snapshot (po_id) ON DELETE CASCADE,
    sort_index INT NOT NULL,
    grn_id BIGINT,
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (po_id, sort_index)
);

CREATE INDEX IF NOT EXISTS idx_inbound_po_detail_grns_grn
    ON inbound_po_detail_grns (grn_id);
