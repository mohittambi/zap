-- eautomate: sku_analytics table
-- Maps to /listings/analytics/sku/:sku_id — inward/outward tracking
-- Append-only with fetched_at for historical tracking

CREATE TABLE sku_analytics (
    id BIGSERIAL PRIMARY KEY,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    inward_30d INT DEFAULT 0,
    inward_60d INT DEFAULT 0,
    inward_90d INT DEFAULT 0,
    outward_30d INT DEFAULT 0,
    outward_60d INT DEFAULT 0,
    outward_90d INT DEFAULT 0,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX sku_analytics_sku_date_idx ON sku_analytics (sku_id, fetched_at);
