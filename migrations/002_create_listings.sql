-- eautomate: listings table (main product/SKU table)
-- Maps to /listings/sku/:sku_id API response

CREATE TABLE IF NOT EXISTS listings (
    id BIGINT PRIMARY KEY,
    sku_id VARCHAR(100) UNIQUE NOT NULL,
    master_sku VARCHAR(100),
    inventory_sku_id VARCHAR(100),
    pack_combo_sku_id VARCHAR(100),
    sku_type VARCHAR(20),
    inventory_bypass_on VARCHAR(5),
    ops_tag VARCHAR(50),
    category TEXT,
    description TEXT,
    meta_fields TEXT,
    img_hd TEXT,
    img_white TEXT,
    img_wdim TEXT,
    img_link1 TEXT,
    img_link2 TEXT,
    no_of_constituents INT DEFAULT 1,
    actual_weight NUMERIC(10,2),
    dimension TEXT,
    bulk_price NUMERIC(10,2),
    keyword_pool TEXT,
    material_info TEXT,
    available_quantity INT DEFAULT 0,
    raw_created_at TIMESTAMPTZ,
    raw_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
