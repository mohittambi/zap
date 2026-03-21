-- eautomate: warehouse_inventory_dump — inventory operation log
-- Maps to /warehouse_inventory_dump/sku_id/by_page/:sku_id
-- Each row = one ADD or REMOVE operation

CREATE TABLE warehouse_inventory_dump (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    inventory_operation_type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    bin_id VARCHAR(100),
    user_id VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_warehouse_inventory_dump_sku ON warehouse_inventory_dump(sku_id);
CREATE INDEX idx_warehouse_inventory_dump_created ON warehouse_inventory_dump(created_at DESC);
