-- Google Sheets sync audit log
-- Tracks every sync run: status, row counts, and any errors for debugging partial failures.

CREATE TABLE IF NOT EXISTS sheets_sync_log (
  id           BIGSERIAL    PRIMARY KEY,
  sync_type    VARCHAR(50)  NOT NULL DEFAULT 'inventory_snapshot',
  status       VARCHAR(20)  NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')),
  rows_written INT          NOT NULL DEFAULT 0,
  rows_failed  INT          NOT NULL DEFAULT 0,
  error_detail TEXT,
  started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sheets_sync_log_started
  ON sheets_sync_log (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sheets_sync_log_status
  ON sheets_sync_log (status, started_at DESC);
