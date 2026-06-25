-- Security hardening: API key prefix, token invalidation, query builder permission, admin audit log

-- Phase 2.3: API key prefix for O(1) lookup
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_prefix VARCHAR(12);
CREATE INDEX IF NOT EXISTS idx_users_api_key_prefix
  ON users (api_key_prefix) WHERE api_key_prefix IS NOT NULL;

-- Phase 2.4: Token invalidation
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_invalidated_at TIMESTAMPTZ;

-- Phase 4.5: Query builder permission
INSERT INTO permissions (resource, action, description)
VALUES ('query_builder', 'read', 'Run custom dashboard queries')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.resource = 'query_builder' AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Phase 6.2: Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id BIGINT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log (created_at DESC);
