-- Add rejected_quantity and short_quantity to debit note lines.
-- Old lines will show 0; regenerating a debit note re-extracts from raw JSON.

ALTER TABLE inbound_zap_debit_note_lines
  ADD COLUMN IF NOT EXISTS rejected_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_quantity    NUMERIC(12,4) NOT NULL DEFAULT 0;
