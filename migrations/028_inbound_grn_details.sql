-- GRN detail snapshot + line items + invoice files (ingested from eautomate detail APIs)

CREATE TABLE IF NOT EXISTS inbound_grn_detail_snapshot (
    grn_id BIGINT PRIMARY KEY REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    po_id BIGINT NOT NULL,
    vendor_id BIGINT NOT NULL,
    vendor_display_name TEXT,
    vendor_address TEXT,
    vendor_gstin VARCHAR(50),
    vendor_contact TEXT,
    po_total_demand INT,
    po_release_date DATE,
    po_expiry_date DATE,
    po_created_by VARCHAR(100),
    grn_box_count_invoice INT,
    grn_actual_boxes INT,
    grn_opened_by VARCHAR(100),
    grn_created_at TIMESTAMPTZ,
    grn_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    po_raw JSONB NOT NULL DEFAULT '{}',
    vendor_raw JSONB NOT NULL DEFAULT '{}',
    grn_header_raw JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_grn_detail_snapshot_po ON inbound_grn_detail_snapshot (po_id);
CREATE INDEX IF NOT EXISTS idx_grn_detail_snapshot_vendor ON inbound_grn_detail_snapshot (vendor_id);

CREATE TABLE IF NOT EXISTS inbound_grn_invoice_files (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    file_id BIGINT NOT NULL,
    file_type VARCHAR(80),
    file_name TEXT,
    uploaded_at TIMESTAMPTZ,
    uploaded_by VARCHAR(100),
    download_url TEXT,
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_grn_invoice_files_grn ON inbound_grn_invoice_files (grn_id);

CREATE TABLE IF NOT EXISTS inbound_grn_added_items (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    line_index INT NOT NULL,
    sku_id VARCHAR(100),
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_grn_added_items_grn ON inbound_grn_added_items (grn_id);

CREATE TABLE IF NOT EXISTS inbound_grn_items (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    line_index INT NOT NULL,
    sku_id VARCHAR(100),
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON inbound_grn_items (grn_id);
