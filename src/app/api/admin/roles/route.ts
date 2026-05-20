import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";

export type AdminRoleRow = {
  id: number;
  name: string;
  description: string | null;
};

/**
 * @swagger
 * /admin/roles:
 *   get:
 *     summary: List all roles
 *     description: Requires admin (*:*).
 *     tags: [Admin]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
/** List all roles — admin only (wildcard `*:*`). */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");

    const res = await query(
      `SELECT id, name, description FROM roles ORDER BY name ASC`
    );
    const rows = res.rows as AdminRoleRow[];
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
