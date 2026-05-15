-- Zap-native debit notes generated from GRN price audits.
-- vendor_price  = received_price from eAutomate grn_items raw JSON
-- audit_price   = audit_price_excl_gst from eAutomate (admin-validated price, excl. GST)
-- When vendor_price > audit_price the difference triggers a debit note.
CREATE TABLE IF NOT EXISTS inbound_zap_debit_notes (
  id               BIGSERIAL PRIMARY KEY,
  grn_id           BIGINT       NOT NULL REFERENCES inbound_grns(grn_id) ON DELETE CASCADE,
  note_reference   VARCHAR(100) NOT NULL UNIQUE,          -- e.g. DN-GRN-12345-20260506
  vendor_id        BIGINT,
  vendor_name      TEXT,
  po_id            BIGINT,
  total_debit_amount NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_count       INT          NOT NULL DEFAULT 0,
  status           VARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','ISSUED','EXPORTED')),
  generated_by     VARCHAR(255),
  generated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  exported_at      TIMESTAMPTZ,
  notes            TEXT,
  UNIQUE (grn_id)
);
CREATE INDEX IF NOT EXISTS idx_izdn_grn ON inbound_zap_debit_notes(grn_id);

CREATE TABLE IF NOT EXISTS inbound_zap_debit_note_lines (
  id              BIGSERIAL PRIMARY KEY,
  debit_note_id   BIGINT        NOT NULL REFERENCES inbound_zap_debit_notes(id) ON DELETE CASCADE,
  grn_id          BIGINT        NOT NULL,
  line_index      INT           NOT NULL,
  sku_id          VARCHAR(100),
  sku_description TEXT,
  quantity        NUMERIC(12,4) NOT NULL DEFAULT 0,
  vendor_price    NUMERIC(12,4) NOT NULL DEFAULT 0,   -- per-unit price vendor billed
  audit_price     NUMERIC(12,4) NOT NULL DEFAULT 0,   -- per-unit price admin approved (excl. GST)
  price_diff      NUMERIC(12,4) NOT NULL DEFAULT 0,   -- vendor_price - audit_price
  debit_amount    NUMERIC(14,4) NOT NULL DEFAULT 0,   -- quantity * price_diff
  UNIQUE (debit_note_id, line_index)
);
CREATE INDEX IF NOT EXISTS idx_izdnl_note ON inbound_zap_debit_note_lines(debit_note_id);
