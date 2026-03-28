-- Inbound: vendors create + warehouse_manager can read/manage vendors
INSERT INTO permissions (resource, action, description) VALUES
  ('vendors', 'create', 'Create vendors')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_manager'
  AND p.resource = 'vendors'
  AND p.action IN ('read', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;
