-- eautomate: pack_combos table
-- Maps to /packs_combos/sku/:sku_id — composite SKU components

CREATE TABLE IF NOT EXISTS pack_combos (
    id BIGSERIAL PRIMARY KEY,
    parent_sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    component_sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    quantity INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
