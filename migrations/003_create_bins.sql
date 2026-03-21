-- eautomate: bins table
-- Warehouse bin locations for a SKU — maps to bins[] in listing API response

CREATE TABLE bins (
    id BIGINT PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    bin_id VARCHAR(100) NOT NULL,
    available_quantity INT DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (warehouse_id, sku_id, bin_id)
);
