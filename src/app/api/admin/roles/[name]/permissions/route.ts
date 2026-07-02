import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { query } from "@/server/db";
import { logAdminAction } from "@/server/services/adminAuditService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import { replaceRolePermissions } from "@/server/services/rolePermissionsService";

export type RolePermissionRow = {
  resource: string;
  action: string;
  description: string | null;
};

type PutBody = {
  permissions?: { resource: string; action: string }[];
};

/**
 * @swagger
 * /admin/roles/{name}/permissions:
 *   get:
 *     summary: List permissions assigned to a role
 *     description: Requires admin (*:*).
 *   put:
 *     summary: Replace permissions assigned to a role
 *     description: Requires admin (*:*). Cannot modify admin wildcard role.
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const admin = await requireAuth(request);
    assertPermission(admin, "*", "*");

    const { name } = await context.params;
    const body = (await request.json().catch(() => ({}))) as PutBody;

    if (!Array.isArray(body.permissions)) {
      throw new AppError("permissions array is required", 400);
    }

    const { added, removed } = await replaceRolePermissions(name, body.permissions);

    const ctx = buildActivityContext(request, admin.id);
    await logActivity({
      ...ctx,
      action: "role_permissions_updated",
      resource: "roles",
      resourceId: name,
      statusCode: 200,
      details: {
        added,
        removed,
        permission_count: body.permissions.length,
      },
    });

    await logAdminAction(admin.id, "role_permissions_updated", null, {
      role: name,
      added,
      removed,
    });

    return NextResponse.json({
      ok: true,
      added,
      removed,
      permission_count: body.permissions.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
