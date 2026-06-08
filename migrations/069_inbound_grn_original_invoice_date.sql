-- Manual original invoice date set by Accounts on GRN detail (Zap-only; not synced from eAutomate).
ALTER TABLE inbound_grns
  ADD COLUMN IF NOT EXISTS original_invoice_date DATE;
