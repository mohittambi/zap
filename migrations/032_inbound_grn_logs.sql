-- GRN activity logs from GET /purchase_orders/grn/logs/{grnId}

CREATE TABLE IF NOT EXISTS inbound_grn_logs (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    log_id BIGINT NOT NULL,
    line_index INT NOT NULL,
    log_type VARCHAR(80),
    operation_performed TEXT,
    po_id BIGINT,
    vendor_id BIGINT,
    foreign_key BIGINT,
    sku_id VARCHAR(100),
    invoice_quantity INT,
    accepted_quantity INT,
    rejected_quantity INT,
    received_price NUMERIC(14, 2),
    remarks TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, log_id)
);

CREATE INDEX IF NOT EXISTS idx_grn_logs_grn_created ON inbound_grn_logs (grn_id, created_at DESC NULLS LAST);
