-- eautomate: inbound_summary cache
-- Maps to /listings/inbound_summary/:sku_id

CREATE TABLE IF NOT EXISTS inbound_summary (
    id BIGSERIAL PRIMARY KEY,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    summary_date DATE,
    quantity INT DEFAULT 0,
    source TEXT,
    raw_data JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_summary_sku ON inbound_summary(sku_id);
