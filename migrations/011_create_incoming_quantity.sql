-- eautomate: incoming_quantity cache
-- Maps to /listings/incoming-quantity/:sku_id

CREATE TABLE incoming_quantity (
    id BIGSERIAL PRIMARY KEY,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    quantity INT DEFAULT 0,
    expected_date DATE,
    source TEXT,
    raw_data JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incoming_quantity_sku ON incoming_quantity(sku_id);
