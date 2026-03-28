-- Remove accounts that 14_users.csv re-inserts (keeps admin@example.com / viewer@example.com from RBAC seed).
DELETE FROM user_roles
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN (
    'admin@ecraftindia.com',
    'warehouse.manager@ecraftindia.com',
    'sales.saumya@ecraftindia.com',
    'vendor.portal@ecraftindia.com'
  )
);

DELETE FROM users
WHERE email IN (
  'admin@ecraftindia.com',
  'warehouse.manager@ecraftindia.com',
  'sales.saumya@ecraftindia.com',
  'vendor.portal@ecraftindia.com'
);
