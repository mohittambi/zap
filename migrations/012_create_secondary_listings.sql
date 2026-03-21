-- eautomate: secondary_listings — channel/marketplace SKU mappings
-- Maps to /inventory/secondary_listings/paginated
-- Maps secondary_sku (channel ID) to master_sku with inventory quantities

CREATE TABLE secondary_listings (
    id BIGINT PRIMARY KEY,
    secondary_sku VARCHAR(200) NOT NULL,
    master_sku VARCHAR(100),
    inventory_sku_id VARCHAR(100),
    pack_combo_sku_id VARCHAR(100),
    sku_type VARCHAR(20),
    inventory_bypass_status VARCHAR(20),
    ais_quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0
);

CREATE INDEX idx_secondary_listings_secondary_sku ON secondary_listings(secondary_sku);
CREATE INDEX idx_secondary_listings_master_sku ON secondary_listings(master_sku);
CREATE INDEX idx_secondary_listings_inventory_sku ON secondary_listings(inventory_sku_id);
