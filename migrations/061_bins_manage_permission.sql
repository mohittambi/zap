-- Adds a fine-grained permission for creating and deleting bin locations.
-- No explicit role_permissions row is inserted — only admin wildcard (*:*) users
-- have this permission automatically (via hasPermission's wildcard check in rbac.ts).
INSERT INTO permissions (resource, action, description)
VALUES ('bins', 'manage', 'Create or delete bin locations')
ON CONFLICT (resource, action) DO NOTHING;
