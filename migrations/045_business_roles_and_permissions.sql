-- Business roles + missing permission tuples + soft-deactivate flag
-- See plan: Ops / Warehouse / Finance / Merchandising / Sales + viewer reads

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Missing permission rows referenced by API assertPermission(...)
INSERT INTO permissions (resource, action, description) VALUES
  ('purchase_orders', 'write', 'Update GRNs, upload files, cancel/modify inbound PO'),
  ('vendors', 'write', 'Update vendor listings and profiles'),
  ('vendors', 'delete', 'Delete vendors'),
  ('inventory', 'write', 'Inventory labels / mutations'),
  ('bins', 'write', 'Update bin assignments'),
  ('listings', 'write', 'Edit SKU listing details'),
  ('forms', 'write', 'Submit or manage form responses')
ON CONFLICT (resource, action) DO NOTHING;

-- New canonical business roles (keep legacy warehouse_manager / vendor unchanged)
INSERT INTO roles (name, description) VALUES
  ('ops_manager', 'Operations / logistics — inbound & outbound workflows, vendors, warehouses, bulk import'),
  ('warehouse_staff', 'Warehouse — receipts, outbound picking workflows, bins, warehouses, labels read'),
  ('finance', 'Finance — PO/GRN read & write without create, vendors read/write, reports/bulk export'),
  ('merchandising', 'Merchandising — listings, catalogues, focus lists, labels, company relations, bulk'),
  ('sales', 'Sales / accounts — catalogue & listings read, focus lists, outbound PO read, outbound sales views')
ON CONFLICT (name) DO NOTHING;

-- ops_manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ops_manager'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'packs_combos' AND p.action = 'read')
    OR (p.resource = 'warehouse_inventory' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'create', 'write'))
    OR (p.resource = 'vendors' AND p.action IN ('read', 'create', 'write'))
    OR (p.resource = 'inventory' AND p.action IN ('read', 'write'))
    OR (p.resource = 'forms' AND p.action = 'read')
    OR (p.resource = 'warehouses' AND p.action = 'read')
    OR (p.resource = 'bins' AND p.action IN ('read', 'write'))
    OR (p.resource = 'focus_lists' AND p.action IN ('read', 'write'))
    OR (p.resource = 'labels' AND p.action IN ('read', 'write'))
    OR (p.resource = 'company_relations' AND p.action IN ('read', 'write'))
    OR (p.resource = 'bulk' AND p.action IN ('read', 'import'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- warehouse_staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'warehouse_staff'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'warehouse_inventory' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'create', 'write'))
    OR (p.resource = 'inventory' AND p.action = 'read')
    OR (p.resource = 'forms' AND p.action = 'read')
    OR (p.resource = 'warehouses' AND p.action = 'read')
    OR (p.resource = 'bins' AND p.action IN ('read', 'write'))
    OR (p.resource = 'labels' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'write'))
    OR (p.resource = 'vendors' AND p.action IN ('read', 'write'))
    OR (p.resource = 'inventory' AND p.action = 'read')
    OR (p.resource = 'bulk' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- merchandising
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'merchandising'
  AND (
    (p.resource = 'listings' AND p.action IN ('read', 'write'))
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'packs_combos' AND p.action = 'read')
    OR (p.resource = 'inventory' AND p.action IN ('read', 'write'))
    OR (p.resource = 'catalogues' AND p.action IN ('read', 'write'))
    OR (p.resource = 'focus_lists' AND p.action IN ('read', 'write'))
    OR (p.resource = 'labels' AND p.action IN ('read', 'write'))
    OR (p.resource = 'company_relations' AND p.action IN ('read', 'write'))
    OR (p.resource = 'bulk' AND p.action IN ('read', 'import'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'sales'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'packs_combos' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action = 'read')
    OR (p.resource = 'inventory' AND p.action = 'read')
    OR (p.resource = 'catalogues' AND p.action = 'read')
    OR (p.resource = 'focus_lists' AND p.action IN ('read', 'write'))
    OR (p.resource = 'labels' AND p.action = 'read')
    OR (p.resource = 'company_relations' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- viewer: inherit every explicit read capability (excluding admin wildcard row)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.action = 'read'
  AND NOT (p.resource = '*' AND p.action = '*')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Align legacy warehouse_manager with commonly used write guards (backward compatibility)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'warehouse_manager'
  AND (
    (p.resource = 'purchase_orders' AND p.action = 'write')
    OR (p.resource = 'inventory' AND p.action = 'write')
    OR (p.resource = 'bins' AND p.action = 'write')
    OR (p.resource = 'listings' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
