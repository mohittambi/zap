-- Inbound vendor purchase orders (eautomate-shaped headers + line items)

CREATE TABLE IF NOT EXISTS vendor_purchase_orders (
    po_id BIGINT PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    vendor_name VARCHAR(200),
    expected_date DATE,
    created_by VARCHAR(100),
    modified_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_published TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    po_remarks TEXT,
    sku_count INT NOT NULL DEFAULT 0,
    total_quantity INT NOT NULL DEFAULT 0,
    number_of_grns INT NOT NULL DEFAULT 0,
    total_invoice_quantity INT NOT NULL DEFAULT 0,
    total_accepted_quantity INT NOT NULL DEFAULT 0,
    total_rejected_quantity INT NOT NULL DEFAULT 0,
    sku_fill_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    quantity_fill_rate NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vendor_po_vendor_created
  ON vendor_purchase_orders (vendor_id, created_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS vendor_purchase_order_lines (
    id BIGSERIAL PRIMARY KEY,
    po_id BIGINT NOT NULL REFERENCES vendor_purchase_orders(po_id) ON DELETE CASCADE,
    sku_id VARCHAR(100) NOT NULL REFERENCES listings(sku_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (po_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_po_lines_po ON vendor_purchase_order_lines(po_id);
