-- Allow CLOSED on Zap debit notes (CN copy upload and explicit close set status = 'CLOSED').
-- Original 049 constraint: CHECK (status IN ('DRAFT','ISSUED','EXPORTED'))

ALTER TABLE inbound_zap_debit_notes
  DROP CONSTRAINT IF EXISTS inbound_zap_debit_notes_status_check;

ALTER TABLE inbound_zap_debit_notes
  ADD CONSTRAINT inbound_zap_debit_notes_status_check
  CHECK (status IN ('DRAFT', 'ISSUED', 'EXPORTED', 'CLOSED'));
