-- Outbound PO form: sold-via master (Eunoia / Intellozene) + file attachments for original PO uploads

CREATE TABLE IF NOT EXISTS outbound_sold_via (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL
);

INSERT INTO outbound_sold_via (code, label) VALUES
  ('eunoia', 'Eunoia'),
  ('intellozene', 'Intellozene')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS outbound_po_attachments (
    id BIGSERIAL PRIMARY KEY,
    outbound_po_id BIGINT NOT NULL REFERENCES outbound_purchase_orders (id) ON DELETE CASCADE,
    original_filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(200),
    size_bytes INT NOT NULL CHECK (size_bytes >= 0),
    stored_path TEXT NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'other',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_po_attachments_po
  ON outbound_po_attachments (outbound_po_id);
