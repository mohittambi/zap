-- Decision Intelligence Hub: config, snapshots, feedback, RBAC permissions.
-- Admin-only via insights:read / insights:manage (no role_permissions grant; wildcard only).

CREATE TABLE IF NOT EXISTS insight_config (
  id                        INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  severity_weight_critical  NUMERIC(6, 2) NOT NULL DEFAULT 3.0,
  severity_weight_warning   NUMERIC(6, 2) NOT NULL DEFAULT 2.0,
  severity_weight_info      NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
  stockout_cover_days       INT NOT NULL DEFAULT 14,
  dead_stock_days           INT NOT NULL DEFAULT 60,
  ordering_cost_default     NUMERIC(14, 2) NOT NULL DEFAULT 500.0,
  holding_cost_pct_default  NUMERIC(6, 4) NOT NULL DEFAULT 0.20,
  digest_enabled            BOOLEAN NOT NULL DEFAULT true,
  extra                     JSONB NOT NULL DEFAULT '{}',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO insight_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS insight_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger      VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  summary      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_snapshots_generated_at
  ON insight_snapshots (generated_at DESC);

CREATE TABLE IF NOT EXISTS insight_snapshot_items (
  id                  BIGSERIAL PRIMARY KEY,
  snapshot_id         BIGINT NOT NULL REFERENCES insight_snapshots(id) ON DELETE CASCADE,
  insight_key         VARCHAR(120) NOT NULL,
  domain              VARCHAR(20) NOT NULL,
  severity            VARCHAR(20) NOT NULL,
  entity_type         VARCHAR(20),
  entity_id           VARCHAR(100),
  title               TEXT NOT NULL,
  rationale           TEXT NOT NULL,
  recommended_action  TEXT NOT NULL,
  impact_value        NUMERIC(14, 2),
  priority            NUMERIC(14, 4) NOT NULL DEFAULT 0,
  raw                 JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_insight_snapshot_items_snapshot
  ON insight_snapshot_items (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_insight_snapshot_items_domain_severity
  ON insight_snapshot_items (domain, severity);

CREATE TABLE IF NOT EXISTS insight_feedback (
  id           BIGSERIAL PRIMARY KEY,
  insight_key  VARCHAR(120) NOT NULL,
  action       VARCHAR(20) NOT NULL,
  snooze_until DATE,
  note         TEXT,
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_key
  ON insight_feedback (insight_key, created_at DESC);

INSERT INTO permissions (resource, action, description) VALUES
  ('insights', 'read', 'View decision intelligence hub and worklist'),
  ('insights', 'manage', 'Configure insights, feedback, and run digest')
ON CONFLICT (resource, action) DO NOTHING;
