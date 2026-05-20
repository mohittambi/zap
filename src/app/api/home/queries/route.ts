import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listSavedQueries } from "@/server/queries/homeSavedQueries";

/**
 * @swagger
 * /home/queries:
 *   get:
 *     summary: List available saved home queries
 *     description: Requires bins:read.
 *     tags: [Home]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
// GET /api/home/queries — list available saved queries with their param specs.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    return NextResponse.json({ queries: listSavedQueries() });
  } catch (err) {
    return handleApiError(err);
  }
}
