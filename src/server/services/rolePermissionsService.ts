import getPool from "@/server/db";
import { AppError } from "@/server/errors";
import { permissionKey } from "@/lib/permission-catalog";

export type PermissionTuple = { resource: string; action: string };

export async function getRolePermissions(roleName: string): Promise<
  { resource: string; action: string; description: string | null }[]
> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT p.resource, p.action, p.description
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = $1
     ORDER BY p.resource, p.action`,
    [roleName]
  );
  return res.rows as { resource: string; action: string; description: string | null }[];
}

export async function replaceRolePermissions(
  roleName: string,
  permissions: PermissionTuple[]
): Promise<{ added: string[]; removed: string[] }> {
  if (roleName === "admin") {
    throw new AppError("Cannot modify admin role permissions via API", 400);
  }

  const pool = getPool();
  const roleRes = await pool.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  if (roleRes.rows.length === 0) {
    throw new AppError("Role not found", 404);
  }
  const roleId = roleRes.rows[0].id as number;

  const unique = new Map<string, PermissionTuple>();
  for (const p of permissions) {
    const resource = String(p.resource ?? "").trim();
    const action = String(p.action ?? "").trim();
    if (!resource || !action) continue;
    if (resource === "*" && action === "*") {
      throw new AppError("Wildcard permission cannot be assigned to non-admin roles", 400);
    }
    unique.set(permissionKey(resource, action), { resource, action });
  }

  const tuples = [...unique.values()];
  if (tuples.length === 0) {
    throw new AppError("At least one permission is required", 400);
  }

  const permRes = await pool.query(
    `SELECT id, resource, action FROM permissions
     WHERE (resource, action) IN (${tuples.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")})`,
    tuples.flatMap((t) => [t.resource, t.action])
  );

  if (permRes.rows.length !== tuples.length) {
    const found = new Set(
      permRes.rows.map((r: { resource: string; action: string }) =>
        permissionKey(r.resource, r.action)
      )
    );
    const missing = tuples
      .filter((t) => !found.has(permissionKey(t.resource, t.action)))
      .map((t) => permissionKey(t.resource, t.action));
    throw new AppError(`Unknown permission(s): ${missing.join(", ")}`, 400);
  }

  const previous = await getRolePermissions(roleName);
  const prevKeys = new Set(previous.map((p) => permissionKey(p.resource, p.action)));
  const nextKeys = new Set(tuples.map((t) => permissionKey(t.resource, t.action)));
  const added = [...nextKeys].filter((k) => !prevKeys.has(k));
  const removed = [...prevKeys].filter((k) => !nextKeys.has(k));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    for (const row of permRes.rows as { id: number }[]) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, row.id]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { added, removed };
}
