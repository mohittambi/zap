import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { query } from "@/server/db";

type PatchBody = {
  is_active?: boolean;
  roles?: string[];
  password?: string;
};

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Update a user (activation, password, roles)
 *     description: Requires admin (*:*).
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active: { type: boolean }
 *               password: { type: string, minLength: 8 }
 *               roles: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: User not found }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAuth(request);
    assertPermission(admin, "*", "*");

    const { id: idStr } = await context.params;
    const userId = Number.parseInt(idStr, 10);
    if (!Number.isFinite(userId) || userId < 1) {
      throw new AppError("Invalid user id", 400);
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;

    const cur = await query(
      `SELECT u.id, u.email, COALESCE(u.is_active, true) AS is_active
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    if (cur.rows.length === 0) {
      throw new AppError("User not found", 404);
    }

    if (typeof body.is_active === "boolean") {
      if (body.is_active === false && userId === admin.id) {
        throw new AppError("You cannot deactivate your own account.", 400);
      }
      await query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [
        body.is_active,
        userId,
      ]);
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 8) {
        throw new AppError("Password must be at least 8 characters", 400);
      }
      const hash = await bcrypt.hash(body.password, 10);
      await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
        hash,
        userId,
      ]);
    }

    if (Array.isArray(body.roles)) {
      const roleNames = [...new Set(body.roles.filter((n) => typeof n === "string" && n.trim()))];
      if (roleNames.length === 0) {
        throw new AppError("At least one role is required", 400);
      }

      const roleRes = await query(
        `SELECT id, name FROM roles WHERE name = ANY($1::text[])`,
        [roleNames]
      );
      if (roleRes.rows.length !== roleNames.length) {
        const found = new Set(roleRes.rows.map((r: { name: string }) => r.name));
        const missing = roleNames.filter((n) => !found.has(n));
        throw new AppError(`Unknown role(s): ${missing.join(", ")}`, 400);
      }

      const hasAdminRole = await query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name = 'admin'`,
        [userId]
      );
      const targetHasAdmin = hasAdminRole.rows.length > 0;
      const stillHasAdmin = roleNames.includes("admin");

      if (userId === admin.id && targetHasAdmin && !stillHasAdmin) {
        throw new AppError("You cannot remove the admin role from your own account.", 400);
      }

      if (targetHasAdmin && !stillHasAdmin) {
        const otherAdmins = await query(
          `SELECT COUNT(*)::int AS c FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'admin' AND ur.user_id != $1`,
          [userId]
        );
        const count = (otherAdmins.rows[0]?.c as number) ?? 0;
        if (count < 1) {
          throw new AppError(
            "Cannot remove admin role: this is the only admin user.",
            400
          );
        }
      }

      await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
      for (const row of roleRes.rows as { id: number }[]) {
        await query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, row.id]
        );
      }
    }

    return NextResponse.json({ ok: true, message: "User updated." });
  } catch (err) {
    return handleApiError(err);
  }
}
