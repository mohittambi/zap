-- Links sample_data/14_users.csv accounts to roles by email (after RBAC seed).
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@ecraftindia.com'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'warehouse_manager'
WHERE u.email = 'warehouse.manager@ecraftindia.com'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'viewer'
WHERE u.email = 'sales.saumya@ecraftindia.com'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'vendor'
WHERE u.email = 'vendor.portal@ecraftindia.com'
ON CONFLICT (user_id, role_id) DO NOTHING;
