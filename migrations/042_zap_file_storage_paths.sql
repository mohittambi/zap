-- Zap-native file storage (Supabase Storage object paths). When set, downloads use Storage instead of legacy upstream proxy.

ALTER TABLE outbound_po_eautomate_files
  ADD COLUMN IF NOT EXISTS zap_storage_path TEXT;

COMMENT ON COLUMN outbound_po_eautomate_files.zap_storage_path IS
  'Supabase Storage object path for this file; when set, download serves from Zap storage.';

ALTER TABLE inbound_grn_invoice_files
  ADD COLUMN IF NOT EXISTS zap_storage_path TEXT;

ALTER TABLE inbound_grn_debit_credit_note_files
  ADD COLUMN IF NOT EXISTS zap_storage_path TEXT;

COMMENT ON COLUMN inbound_grn_invoice_files.zap_storage_path IS
  'Supabase Storage object path; when set, download serves from Zap storage.';

COMMENT ON COLUMN inbound_grn_debit_credit_note_files.zap_storage_path IS
  'Supabase Storage object path; when set, download serves from Zap storage.';
