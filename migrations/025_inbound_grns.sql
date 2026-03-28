-- Inbound GRNs from eautomate POST /purchase_orders/grn/all/paginated

CREATE TABLE IF NOT EXISTS inbound_grns (
    grn_id BIGINT PRIMARY KEY,
    po_id BIGINT NOT NULL,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    vendor_name VARCHAR(200),
    grn_status VARCHAR(80),
    grn_audit_status VARCHAR(80),
    grn_audit_by VARCHAR(100),
    grn_invoice_collection_status VARCHAR(80),
    grn_invoice_collection_by VARCHAR(100),
    vendor_invoice_number VARCHAR(200),
    box_count_invoice INT NOT NULL DEFAULT 0,
    actual_box_count_received INT NOT NULL DEFAULT 0,
    grn_sku_count INT NOT NULL DEFAULT 0,
    grn_invoice_quantity INT NOT NULL DEFAULT 0,
    grn_accepted_quantity INT NOT NULL DEFAULT 0,
    grn_rejected_quantity INT NOT NULL DEFAULT 0,
    grn_shortage_quantity INT NOT NULL DEFAULT 0,
    po_sku_count INT NOT NULL DEFAULT 0,
    po_total_quantity INT NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_grns_vendor_created
  ON inbound_grns (vendor_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_inbound_grns_po ON inbound_grns (po_id);

CREATE INDEX IF NOT EXISTS idx_inbound_grns_created_at
  ON inbound_grns (created_at DESC NULLS LAST);
