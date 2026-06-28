-- Comprehensive activity log for admin audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  session_id   UUID,
  action       VARCHAR(100) NOT NULL,
  resource     VARCHAR(100),
  resource_id  VARCHAR(200),
  details      JSONB DEFAULT '{}',
  ip_address   INET,
  user_agent   TEXT,
  path         TEXT,
  method       VARCHAR(10),
  status_code  SMALLINT,
  duration_ms  INT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_time
  ON activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource
  ON activity_log (resource, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_time
  ON activity_log (created_at DESC);

-- Soft-delete for master listings (admin-only delete)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_listings_active
  ON listings (sku_id) WHERE is_deleted = false;
