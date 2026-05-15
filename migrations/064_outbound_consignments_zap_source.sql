-- Distinguish zap-created consignments from eAutomate-synced ones.
-- Existing rows default to 'eautomate'.

ALTER TABLE outbound_consignments
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'eautomate'
  CHECK (source IN ('zap', 'eautomate'));

ALTER TABLE outbound_consignments
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(120);

ALTER TABLE outbound_consignments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outbound_consignments_source ON outbound_consignments (source);

-- Zap-created consignments use a high range (10^10+) so they cannot collide
-- with eAutomate's id space.
CREATE SEQUENCE IF NOT EXISTS outbound_consignments_zap_id_seq
  AS BIGINT START WITH 10000000001 INCREMENT BY 1 NO MAXVALUE;
