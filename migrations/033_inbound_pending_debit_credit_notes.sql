-- Pending debit/credit notes from eautomate POST .../grn/debit_credit_notes/paginated
-- Replaced on each sync-eautomate-pending-debit-credit-notes run.

CREATE TABLE IF NOT EXISTS inbound_pending_debit_credit_notes (
    note_id BIGINT PRIMARY KEY,
    grn_id BIGINT NOT NULL,
    credit_debit_note_type VARCHAR(120),
    credit_debit_note_status VARCHAR(80),
    credit_debit_note_number TEXT,
    credit_debit_note_number_assignment_status VARCHAR(80),
    credit_debit_note_upload_status VARCHAR(80),
    credit_debit_note_uploaded_by VARCHAR(100),
    reverse_credit_debit_note_number TEXT,
    reverse_credit_debit_note_upload_status VARCHAR(80),
    reverse_credit_debit_note_uploaded_by VARCHAR(100),
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    po_id BIGINT,
    grn_status VARCHAR(80),
    grn_audit_status VARCHAR(80),
    grn_audit_by VARCHAR(100),
    vendor_invoice_number VARCHAR(200),
    box_count_invoice INT,
    actual_box_count_recieved INT,
    vendor_id BIGINT,
    vendor_name VARCHAR(200),
    raw JSONB NOT NULL DEFAULT '{}',
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_dcn_grn ON inbound_pending_debit_credit_notes (grn_id);
CREATE INDEX IF NOT EXISTS idx_pending_dcn_vendor ON inbound_pending_debit_credit_notes (vendor_id);
CREATE INDEX IF NOT EXISTS idx_pending_dcn_updated ON inbound_pending_debit_credit_notes (updated_at DESC NULLS LAST);
