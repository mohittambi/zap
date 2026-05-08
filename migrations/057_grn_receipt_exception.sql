-- Tracks whether any GRN line has a receipt exception (shortage or rejection).
-- Set automatically when GRN team enters quantities; cleared if all lines are later corrected.
ALTER TABLE inbound_grns
  ADD COLUMN IF NOT EXISTS zap_receipt_exception BOOLEAN NOT NULL DEFAULT FALSE;
