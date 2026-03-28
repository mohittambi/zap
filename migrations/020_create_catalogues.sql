-- Product catalogues (standard vs custom) and SKU membership

CREATE TABLE IF NOT EXISTS catalogues (
    id SERIAL PRIMARY KEY,
    catalogue_type VARCHAR(20) NOT NULL CHECK (catalogue_type IN ('standard', 'custom')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogues_type ON catalogues (catalogue_type);

CREATE TABLE IF NOT EXISTS catalogue_items (
    id BIGSERIAL PRIMARY KEY,
    catalogue_id INT NOT NULL REFERENCES catalogues(id) ON DELETE CASCADE,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    moq INT,
    display_price NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (catalogue_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_catalogue_items_catalogue ON catalogue_items (catalogue_id);
