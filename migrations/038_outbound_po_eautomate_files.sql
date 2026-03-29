-- Files listed by eAutomate GET .../fetch_po_detail_files/{po_number} (synced on PO detail view / ingest)

CREATE TABLE IF NOT EXISTS outbound_po_eautomate_files (
    eautomate_file_id BIGINT PRIMARY KEY,
    outbound_po_id BIGINT NOT NULL REFERENCES outbound_purchase_orders (id) ON DELETE CASCADE,
    po_number VARCHAR(80) NOT NULL,
    consignment_id BIGINT,
    invoice_id BIGINT,
    appointment_id BIGINT,
    file_type VARCHAR(80),
    file_name VARCHAR(500) NOT NULL,
    saved_file_name VARCHAR(500),
    file_path TEXT,
    file_uploaded_by VARCHAR(120),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_outbound_po_ea_files_po
  ON outbound_po_eautomate_files (outbound_po_id);

CREATE INDEX IF NOT EXISTS idx_outbound_po_ea_files_po_number
  ON outbound_po_eautomate_files (po_number);
