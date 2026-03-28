-- RBAC seed: roles, permissions, role_permissions, admin user
-- Run after migrations 013 and 014
-- Default admin: admin@example.com / admin123
-- Default API key: zap_seed_admin_key (use Authorization: Bearer zap_seed_admin_key)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Full access to all resources'),
  ('warehouse_manager', 'Warehouse and inventory operations'),
  ('viewer', 'Read-only access to listings, analytics, inventory'),
  ('vendor', 'Vendor and purchase order read access')
ON CONFLICT (name) DO NOTHING;

-- Permissions (resource:action)
INSERT INTO permissions (resource, action, description) VALUES
  ('*', '*', 'Admin wildcard - all permissions'),
  ('listings', 'read', 'Listings API'),
  ('analytics', 'read', 'SKU analytics'),
  ('packs_combos', 'read', 'Pack/combo components'),
  ('warehouse_inventory', 'read', 'Warehouse inventory dump'),
  ('purchase_orders', 'read', 'Purchase orders'),
  ('purchase_orders', 'create', 'Create inbound/vendor purchase orders'),
  ('vendors', 'read', 'Vendors'),
  ('vendors', 'create', 'Create vendors'),
  ('inventory', 'read', 'Inventory secondary listings'),
  ('forms', 'read', 'Forms categories and submissions'),
  ('warehouses', 'read', 'Warehouses list and by id'),
  ('bins', 'read', 'Bins list and by id')
ON CONFLICT (resource, action) DO NOTHING;

-- Role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.resource = '*' AND p.action = '*'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_manager' AND (
  (p.resource IN ('warehouse_inventory', 'inventory', 'forms', 'warehouses', 'bins') AND p.action = 'read')
  OR (p.resource = 'vendors' AND p.action IN ('read', 'create'))
  OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'create'))
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.resource IN ('listings', 'analytics', 'packs_combos', 'warehouse_inventory', 'purchase_orders', 'vendors', 'inventory', 'forms', 'warehouses', 'bins') AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'vendor' AND p.resource IN ('vendors', 'purchase_orders', 'listings') AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin user (admin@example.com / admin123, API key: zap_seed_admin_key)
INSERT INTO users (email, password_hash, api_key_hash, created_at, updated_at)
VALUES (
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  crypt('zap_seed_admin_key', gen_salt('bf')),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@example.com' AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Viewer user for testing (viewer@example.com / viewer123)
INSERT INTO users (email, password_hash, created_at, updated_at)
VALUES (
  'viewer@example.com',
  crypt('viewer123', gen_salt('bf')),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'viewer@example.com' AND r.name = 'viewer'
ON CONFLICT (user_id, role_id) DO NOTHING;
