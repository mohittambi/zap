-- Mirror migration 059 for GRNs: distinguish zap-created from eAutomate-synced
-- rows so the detail-ingest and display layers can short-circuit eAutomate
-- traffic for zap-only GRNs. Replaces the negative-grn_id pattern that has
-- historically marked zap-created drafts.

ALTER TABLE inbound_grns
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'eautomate'
  CHECK (source IN ('zap', 'eautomate'));

CREATE INDEX IF NOT EXISTS idx_inbound_grns_source ON inbound_grns (source);

-- Zap-created GRNs use a high-range sequence (10^10+) so they cannot collide
-- with eAutomate's id space. Existing negative-id drafts keep their ids and
-- can be backfilled with `UPDATE inbound_grns SET source='zap' WHERE grn_id < 0;`.
CREATE SEQUENCE IF NOT EXISTS inbound_grns_zap_id_seq
  AS BIGINT START WITH 10000000001 INCREMENT BY 1 NO MAXVALUE;

-- Backfill: any pre-existing negative-id rows are zap-created drafts.
UPDATE inbound_grns SET source = 'zap' WHERE grn_id < 0 AND source = 'eautomate';
