-- GRN documents: live GRN API snapshot + debit/credit notes and nested files

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inbound_grn_detail_snapshot'
      AND column_name = 'grn_api_raw'
  ) THEN
    ALTER TABLE inbound_grn_detail_snapshot
      ADD COLUMN grn_api_raw JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS inbound_grn_debit_credit_notes (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    note_id BIGINT NOT NULL,
    po_id BIGINT,
    credit_debit_note_type VARCHAR(120),
    credit_debit_note_status VARCHAR(80),
    credit_debit_note_number TEXT,
    credit_debit_note_number_assignment_status VARCHAR(80),
    credit_debit_note_upload_status VARCHAR(80),
    credit_debit_note_uploaded_by VARCHAR(100),
    reverse_credit_debit_note_number TEXT,
    reverse_credit_debit_note_upload_status VARCHAR(80),
    reverse_credit_debit_note_uploaded_by VARCHAR(100),
    grn_status VARCHAR(80),
    grn_audit_status VARCHAR(80),
    grn_audit_by VARCHAR(100),
    vendor_invoice_number VARCHAR(200),
    box_count_invoice INT,
    actual_box_count_recieved INT,
    vendor_id BIGINT,
    vendor_name VARCHAR(200),
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_grn_dcn_grn ON inbound_grn_debit_credit_notes (grn_id);

CREATE TABLE IF NOT EXISTS inbound_grn_debit_credit_note_files (
    grn_id BIGINT NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
    note_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    file_type VARCHAR(120),
    file_name TEXT,
    saved_file_name TEXT,
    file_path TEXT,
    uploaded_at TIMESTAMPTZ,
    uploaded_by VARCHAR(100),
    download_url TEXT,
    raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (grn_id, note_id, file_id),
    FOREIGN KEY (grn_id, note_id)
      REFERENCES inbound_grn_debit_credit_notes (grn_id, note_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grn_dcn_files_grn ON inbound_grn_debit_credit_note_files (grn_id);
