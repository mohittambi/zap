import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getReorderMetrics } from "@/server/services/reorderService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /reorder/metrics:
 *   get:
 *     summary: SKU reorder metrics (paginated)
 *     description: Requires bins:read.
 *     tags: [Reorder]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: keyword, schema: { type: string } }
 *       - { in: query, name: alerts_only, schema: { type: string, enum: ["true"] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
// GET /api/reorder/metrics — all SKU reorder metrics, optional keyword filter
// ?alerts_only=true  — restrict to SKUs in alert state
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, { page: 1, limit: 50, maxLimit: 200 });
    const data = await getReorderMetrics({
      keyword: q.keyword,
      alertsOnly: q.alerts_only === "true",
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
