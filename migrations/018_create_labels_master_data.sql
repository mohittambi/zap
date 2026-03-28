-- Labels master: EAN, dimensions, MRP per channel SKU

CREATE TABLE IF NOT EXISTS labels_master_data (
    id BIGSERIAL PRIMARY KEY,
    secondary_sku VARCHAR(200) NOT NULL UNIQUE,
    ean_code VARCHAR(32),
    size TEXT,
    color TEXT,
    one_set_contains TEXT,
    material TEXT,
    mrp NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labels_master_secondary ON labels_master_data (secondary_sku);
