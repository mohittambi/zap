import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { query } from "@/server/db";

export type RolePermissionRow = {
  resource: string;
  action: string;
  description: string | null;
};

/**
 * @swagger
 * /admin/roles/{name}/permissions:
 *   get:
 *     summary: List permissions assigned to a role
 *     description: Requires admin (*:*).
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Role not found }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");

    const { name } = await context.params;

    const roleCheck = await query(`SELECT id FROM roles WHERE name = $1`, [name]);
    if (roleCheck.rows.length === 0) throw new AppError("Role not found", 404);

    const res = await query(
      `SELECT p.resource, p.action, p.description
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = $1
       ORDER BY p.resource, p.action`,
      [name]
    );
    return NextResponse.json(res.rows as RolePermissionRow[]);
  } catch (err) {
    return handleApiError(err);
  }
}
