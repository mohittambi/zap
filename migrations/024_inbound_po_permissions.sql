-- Inbound: warehouse_manager can read/create vendor (inbound) purchase orders

INSERT INTO permissions (resource, action, description) VALUES
  ('purchase_orders', 'create', 'Create inbound/vendor purchase orders')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'warehouse_manager'
  AND p.resource = 'purchase_orders'
  AND p.action IN ('read', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;
