-- Per-channel company code on secondary SKU association (e.g. marketplace listing id).

ALTER TABLE company_secondary_sku
  ADD COLUMN IF NOT EXISTS company_code_primary VARCHAR(50);

ALTER TABLE company_secondary_sku
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE company_secondary_sku SET updated_at = created_at WHERE updated_at IS NULL;
