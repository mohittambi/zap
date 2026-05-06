-- Change history log for secondary listings mutations
CREATE TABLE IF NOT EXISTS secondary_listings_logs (
  id            BIGSERIAL PRIMARY KEY,
  secondary_sku VARCHAR(200) NOT NULL,
  company_id    BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  operation     VARCHAR(80)  NOT NULL,
  field_name    VARCHAR(100),
  old_value     JSONB,
  new_value     JSONB,
  created_by    VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  raw           JSONB
);

CREATE INDEX IF NOT EXISTS idx_sl_logs_sku     ON secondary_listings_logs(secondary_sku);
CREATE INDEX IF NOT EXISTS idx_sl_logs_created ON secondary_listings_logs(created_at DESC);
