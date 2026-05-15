-- GRN close tracking
ALTER TABLE inbound_grns
  ADD COLUMN IF NOT EXISTS closed_by  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS closed_at  TIMESTAMPTZ;

-- Outbound consignment invoice file upload
ALTER TABLE outbound_consignments
  ADD COLUMN IF NOT EXISTS invoice_file_path      TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invoice_uploaded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_by    VARCHAR(255);

-- DN number + CN copy on Zap-generated debit notes
ALTER TABLE inbound_zap_debit_notes
  ADD COLUMN IF NOT EXISTS dn_number              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dn_number_assigned_by  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dn_number_assigned_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cn_copy_file_path      TEXT,
  ADD COLUMN IF NOT EXISTS cn_copy_file_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cn_copy_uploaded_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cn_copy_uploaded_by    VARCHAR(255);
