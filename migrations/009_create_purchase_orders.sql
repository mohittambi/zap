-- eautomate: listing_order_details (incoming purchase orders)
-- Maps to /incoming_purchase_orders/listing_order_details/:sku_id
-- Denormalized: each row = one PO line with full PO + SKU details

CREATE TABLE IF NOT EXISTS listing_order_details (
    id BIGINT PRIMARY KEY,
    po_number VARCHAR(50),
    po_secondary_sku VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    master_sku VARCHAR(100),
    inventory_sku_id VARCHAR(100),
    pack_combo_sku_id VARCHAR(100),
    sku_type VARCHAR(20),
    company_code_primary VARCHAR(50),
    company_code_secondary VARCHAR(50),
    demand INT DEFAULT 0,
    hsn_code VARCHAR(20),
    title TEXT,
    mrp NUMERIC(12,2),
    rate_without_tax NUMERIC(12,2),
    tax_rate NUMERIC(5,2),
    size VARCHAR(50),
    color VARCHAR(50),
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    dispatched_quantity INT DEFAULT 0,
    packed_quantity INT DEFAULT 0,
    company_name VARCHAR(200),
    delivery_city VARCHAR(100),
    po_issue_date TIMESTAMP,
    expiry_date TIMESTAMP,
    po_type VARCHAR(50),
    calculated_po_status VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_listing_order_details_po_secondary_sku ON listing_order_details(po_secondary_sku);
