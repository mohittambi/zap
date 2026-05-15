-- Consignment detail sync: listings/paginated line items, transporter master, valid box names,
-- plus richer GET .../consignments/consignment_details/{id} payload on outbound_consignments.

-- Line items from GET .../incoming_purchase_orders/listings/paginated/{po_number}
CREATE TABLE IF NOT EXISTS outbound_consignment_items (
    id BIGSERIAL PRIMARY KEY,
    consignment_id BIGINT NOT NULL REFERENCES outbound_consignments (id) ON DELETE CASCADE,
    po_number VARCHAR(80),
    po_secondary_sku VARCHAR(120),
    company_code_primary VARCHAR(120),
    company_code_secondary VARCHAR(120),
    box_number INTEGER,
    box_quantity INTEGER,
    box_name VARCHAR(120),
    submitted_from VARCHAR(80),
    mrp NUMERIC(12, 2),
    original_demand INTEGER,
    dispatched_quantity INTEGER,
    consignment_quantity INTEGER,
    overall_fill_rate NUMERIC(10, 4),
    created_by VARCHAR(120),
    created_at_ea TIMESTAMPTZ,
    updated_at_ea TIMESTAMPTZ,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_consignment_items_consignment
    ON outbound_consignment_items (consignment_id);

CREATE INDEX IF NOT EXISTS idx_outbound_consignment_items_po
    ON outbound_consignment_items (po_number);

-- GET /public/api/transporter_details
CREATE TABLE IF NOT EXISTS outbound_transporter_details (
    id BIGINT PRIMARY KEY,
    name VARCHAR(300),
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_transporter_details_name
    ON outbound_transporter_details (name);

-- GET /public/api/incoming_purchase_orders/valid_box_names
CREATE TABLE IF NOT EXISTS outbound_valid_box_names (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL UNIQUE,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GET .../consignments/consignment_details/{id}
ALTER TABLE outbound_consignments
    ADD COLUMN IF NOT EXISTS detail_raw JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS detail_synced_at TIMESTAMPTZ;
