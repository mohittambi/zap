-- Track origin of listing rows (eautomate sync vs Zap UI create)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'eautomate',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(200);

-- Ensure the stub ID sequence exists for Zap-created listings (idempotent)
CREATE SEQUENCE IF NOT EXISTS listings_stub_id_seq
  MINVALUE 1 START WITH 1000000000000000;
