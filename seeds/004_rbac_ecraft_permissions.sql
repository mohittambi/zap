-- Additional permissions for eCraft parity (run after 001)
-- Admin already has *:* wildcard

INSERT INTO permissions (resource, action, description) VALUES
  ('catalogues', 'read', 'Catalogues list and detail'),
  ('catalogues', 'write', 'Create/update catalogues and items'),
  ('focus_lists', 'read', 'Focus lists'),
  ('focus_lists', 'write', 'Create/edit focus lists'),
  ('labels', 'read', 'Labels master data'),
  ('labels', 'write', 'Edit labels master data'),
  ('company_relations', 'read', 'Company–secondary SKU relations'),
  ('company_relations', 'write', 'Edit company–SKU relations'),
  ('bulk', 'read', 'Bulk export'),
  ('bulk', 'import', 'Bulk import uploads')
ON CONFLICT (resource, action) DO NOTHING;

-- warehouse_manager: read/write catalogues, focus lists, bulk, labels, company
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_manager'
  AND (
    (p.resource = 'catalogues' AND p.action IN ('read', 'write'))
    OR (p.resource = 'focus_lists' AND p.action IN ('read', 'write'))
    OR (p.resource = 'labels' AND p.action IN ('read', 'write'))
    OR (p.resource = 'company_relations' AND p.action IN ('read', 'write'))
    OR (p.resource = 'bulk' AND p.action IN ('read', 'import'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- viewer: read-only on new resources
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND (
    (p.resource = 'catalogues' AND p.action = 'read')
    OR (p.resource = 'focus_lists' AND p.action = 'read')
    OR (p.resource = 'labels' AND p.action = 'read')
    OR (p.resource = 'company_relations' AND p.action = 'read')
    OR (p.resource = 'bulk' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
