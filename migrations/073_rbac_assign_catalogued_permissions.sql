-- Assign previously admin-only catalogued permissions to business roles.
-- bins:manage, forms:write, query_builder:read, vendors:delete
-- Admin retains *:* wildcard; these rows extend non-admin roles.

-- ops_manager: full ops control including bin lifecycle, forms, dashboard queries, vendor delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ops_manager'
  AND (
    (p.resource = 'bins' AND p.action = 'manage')
    OR (p.resource = 'forms' AND p.action = 'write')
    OR (p.resource = 'query_builder' AND p.action = 'read')
    OR (p.resource = 'vendors' AND p.action = 'delete')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- warehouse_staff: operational forms + bin location management (not vendor delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'warehouse_staff'
  AND (
    (p.resource = 'bins' AND p.action = 'manage')
    OR (p.resource = 'forms' AND p.action = 'write')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance: forms + read-only dashboard queries
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND (
    (p.resource = 'forms' AND p.action = 'write')
    OR (p.resource = 'query_builder' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- sales: dashboard queries for account visibility
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'sales'
  AND p.resource = 'query_builder' AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
