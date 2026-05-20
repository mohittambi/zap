import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";

/**
 * @swagger
 * /home/companies:
 *   get:
 *     summary: Companies dropdown for home filters
 *     description: Requires bins:read.
 *     tags: [Home]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
// GET /api/home/companies — minimal {id,name}[] for the home filter dropdown.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const r = await query(
      `SELECT id, COALESCE(name, code_primary, id::text) AS name
       FROM   companies
       WHERE  COALESCE(is_active, 1) = 1
       ORDER  BY name ASC`
    );
    return NextResponse.json({
      companies: r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
