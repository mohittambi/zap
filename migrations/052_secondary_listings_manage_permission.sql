-- Add secondary_listings:manage permission and assign to merchandising + ops_manager roles
INSERT INTO permissions (resource, action, description) VALUES
  ('secondary_listings', 'read',   'Read secondary listings, company associations, labels'),
  ('secondary_listings', 'manage', 'Create / update / delete secondary listing company associations and labels')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant manage to merchandising and ops_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('merchandising', 'ops_manager')
  AND p.resource = 'secondary_listings'
  AND p.action IN ('read', 'manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant read-only to viewer, sales, finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('viewer', 'sales', 'finance', 'warehouse_staff', 'warehouse_manager')
  AND p.resource = 'secondary_listings'
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
