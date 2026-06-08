-- Manual invoice type set by Accounts on consignment detail (Zap-only; not synced from eAutomate).
ALTER TABLE outbound_consignments
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(80);
