-- eautomate: vendors, vendor_sku, vendor_specialties
-- Maps to /vendors/sku/:sku_id — returns vendor_sku rows with nested vendor + specialties

CREATE TABLE IF NOT EXISTS vendors (
    id BIGINT PRIMARY KEY,
    vendor_name VARCHAR(200),
    created_by VARCHAR(100),
    modified_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    vendor_address_line TEXT,
    vendor_city VARCHAR(100),
    vendor_state VARCHAR(100),
    vendor_postal_code VARCHAR(20),
    vendor_gstin VARCHAR(50),
    vendor_contact_number VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS vendor_specialties (
    id BIGINT PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id),
    vendor_speciality VARCHAR(100),
    created_by VARCHAR(100),
    modified_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vendor_specialties_vendor ON vendor_specialties(vendor_id);

-- vendor-SKU associations with cost_price
CREATE TABLE IF NOT EXISTS vendor_sku (
    id BIGINT PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id),
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    cost_price NUMERIC(12,2),
    modified_by VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE (vendor_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_sku_sku ON vendor_sku(sku_id);
