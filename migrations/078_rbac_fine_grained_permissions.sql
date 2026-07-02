-- Fine-grained RBAC: new permissions, business roles, default grants.
-- Replaces hard-coded admin role checks with assignable permissions.

INSERT INTO permissions (resource, action, description) VALUES
  ('listings', 'create', 'Create master SKU listings'),
  ('listings', 'delete', 'Soft-delete master listings'),
  ('grn', 'audit', 'Mark GRN audit complete'),
  ('grn', 'accounts_approve', 'Approve or reject GRN accounts'),
  ('grn', 'invoice_collect', 'Mark GRN vendor invoice collected'),
  ('debit_credit', 'decide', 'Accept or decline pending debit/credit notes')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO roles (name, description) VALUES
  ('inventory_management', 'Inventory — stock, bins, GRN receipt, listings read'),
  ('ops_management', 'Operations — outbound + inventory management + listings read'),
  ('qc', 'QC — listings read + inbound inspection')
ON CONFLICT (name) DO NOTHING;

-- Grant new elevated permissions to admin (wildcard already covers; explicit for UI catalog)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND (
    (p.resource = 'listings' AND p.action IN ('create', 'delete'))
    OR (p.resource = 'grn' AND p.action IN ('audit', 'accounts_approve', 'invoice_collect'))
    OR (p.resource = 'debit_credit' AND p.action = 'decide')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- inventory_management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'inventory_management'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'secondary_listings' AND p.action = 'read')
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'packs_combos' AND p.action = 'read')
    OR (p.resource = 'bins' AND p.action IN ('read', 'write', 'manage'))
    OR (p.resource = 'warehouses' AND p.action = 'read')
    OR (p.resource = 'warehouse_inventory' AND p.action = 'read')
    OR (p.resource = 'inventory' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'write'))
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance: extend existing role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND (
    (p.resource = 'grn' AND p.action = 'invoice_collect')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ops_management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ops_management'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'secondary_listings' AND p.action = 'read')
    OR (p.resource = 'analytics' AND p.action = 'read')
    OR (p.resource = 'packs_combos' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'create', 'write'))
    OR (p.resource = 'bins' AND p.action IN ('read', 'write', 'manage'))
    OR (p.resource = 'warehouses' AND p.action = 'read')
    OR (p.resource = 'warehouse_inventory' AND p.action = 'read')
    OR (p.resource = 'inventory' AND p.action = 'read')
    OR (p.resource = 'forms' AND p.action = 'write')
    OR (p.resource = 'query_builder' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- qc
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'qc'
  AND (
    (p.resource = 'listings' AND p.action = 'read')
    OR (p.resource = 'secondary_listings' AND p.action = 'read')
    OR (p.resource = 'purchase_orders' AND p.action IN ('read', 'create', 'write'))
    OR (p.resource = 'vendors' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- merchandising: listings create/delete for catalog team
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'merchandising'
  AND (p.resource = 'listings' AND p.action IN ('create', 'delete'))
ON CONFLICT (role_id, permission_id) DO NOTHING;
