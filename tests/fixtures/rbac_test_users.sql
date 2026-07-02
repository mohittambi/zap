-- RBAC integration test users (dev only). Password for all: rbac123
-- Run: psql $DATABASE_URL -f tests/fixtures/rbac_test_users.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (email, password_hash, is_active, created_at, updated_at)
VALUES
  ('rbac-admin@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-inv@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-ops@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-qc@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-finance@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-viewer@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-merch@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW()),
  ('rbac-none@test.local', crypt('rbac123', gen_salt('bf')), true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = NOW();

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-admin@test.local' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-inv@test.local' AND r.name = 'inventory_management'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-ops@test.local' AND r.name = 'ops_management'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-qc@test.local' AND r.name = 'qc'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-finance@test.local' AND r.name = 'finance'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-viewer@test.local' AND r.name = 'viewer'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'rbac-merch@test.local' AND r.name = 'merchandising'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- rbac-none@test.local intentionally has no roles
