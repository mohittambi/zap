-- Outbound (sales) purchase order headers + analytics JSON
-- Companies: extend with attributes / active flag for channel master

ALTER TABLE companies ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active SMALLINT DEFAULT 1;

CREATE TABLE IF NOT EXISTS delivery_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS outbound_purchase_orders (
    id BIGINT PRIMARY KEY,
    sold_via VARCHAR(80),
    company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    po_number VARCHAR(80) NOT NULL UNIQUE,
    delivery_city VARCHAR(120),
    delivery_address TEXT,
    billing_address TEXT,
    buyer_gstin VARCHAR(32),
    po_issue_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    po_type VARCHAR(80),
    po_creation_status VARCHAR(80),
    po_acknowledgement_status VARCHAR(80),
    po_fulfillment_status VARCHAR(80),
    created_by VARCHAR(120),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_wip VARCHAR(10),
    remarks TEXT,
    company_name VARCHAR(220),
    analytics_object JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculated_po_status VARCHAR(120)
);

CREATE INDEX IF NOT EXISTS idx_outbound_po_created_at ON outbound_purchase_orders (created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_outbound_po_company_id ON outbound_purchase_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_outbound_po_delivery_city ON outbound_purchase_orders (delivery_city);
CREATE INDEX IF NOT EXISTS idx_outbound_po_is_wip ON outbound_purchase_orders (is_wip);
CREATE INDEX IF NOT EXISTS idx_outbound_po_calculated_status ON outbound_purchase_orders (calculated_po_status);
