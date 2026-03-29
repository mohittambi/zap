-- Outbound consignments: POST .../incoming_purchase_orders/consignments/all/paginated
-- Denormalized columns + full `raw` JSONB for every upstream key.

CREATE TABLE IF NOT EXISTS outbound_consignments (
    id BIGINT PRIMARY KEY,
    company_id BIGINT REFERENCES companies (id) ON DELETE SET NULL,
    company_name VARCHAR(220),
    location VARCHAR(200),
    sold_via VARCHAR(80),
    po_number VARCHAR(80),
    po_type VARCHAR(80),
    consignment_status VARCHAR(80),
    invoice_number_status VARCHAR(80),
    invoice_number VARCHAR(120),
    invoice_upload_status VARCHAR(80),
    boxes_count INTEGER,
    sku_count INTEGER,
    total_quantity INTEGER,
    transporter_name VARCHAR(220),
    vehicle_number VARCHAR(160),
    docket_number VARCHAR(160),
    created_at TIMESTAMPTZ,
    marked_rtd_at TIMESTAMPTZ,
    marked_rtd_by VARCHAR(120),
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_consignments_po ON outbound_consignments (po_number);
CREATE INDEX IF NOT EXISTS idx_outbound_consignments_company_id ON outbound_consignments (company_id);
CREATE INDEX IF NOT EXISTS idx_outbound_consignments_location ON outbound_consignments (location);
CREATE INDEX IF NOT EXISTS idx_outbound_consignments_status ON outbound_consignments (consignment_status);
CREATE INDEX IF NOT EXISTS idx_outbound_consignments_created ON outbound_consignments (created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_outbound_consignments_marked_rtd ON outbound_consignments (marked_rtd_at DESC NULLS LAST);

-- GET .../incoming_purchase_orders/delivery_locations (filter master for UI + sync)

CREATE TABLE IF NOT EXISTS outbound_consignment_delivery_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_cons_dl_name ON outbound_consignment_delivery_locations (name);
