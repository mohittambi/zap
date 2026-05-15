-- PO activity log lines from eAutomate (GET .../logs or equivalent).

CREATE TABLE IF NOT EXISTS outbound_po_logs (
    id BIGINT PRIMARY KEY,
    outbound_po_id BIGINT NOT NULL REFERENCES outbound_purchase_orders (id) ON DELETE CASCADE,
    po_number VARCHAR(80),
    consignment_id BIGINT,
    foreign_key BIGINT,
    operation VARCHAR(160),
    remarks TEXT,
    created_by VARCHAR(160),
    created_at TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_po_logs_po ON outbound_po_logs (outbound_po_id);
CREATE INDEX IF NOT EXISTS idx_outbound_po_logs_created ON outbound_po_logs (created_at DESC NULLS LAST);
