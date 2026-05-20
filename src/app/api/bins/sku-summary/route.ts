import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getSkuInventorySummary } from "@/server/services/binsService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /bins/sku-summary:
 *   get:
 *     summary: SKU-level inventory summary across bins
 *     description: Requires bins:read.
 *     tags: [Bins]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 200, maximum: 500 } }
 *       - { in: query, name: warehouse_id, schema: { type: string } }
 *       - { in: query, name: keyword, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, { page: 1, limit: 200, maxLimit: 500 });
    const data = await getSkuInventorySummary(
      { warehouse_id: q.warehouse_id, keyword: q.keyword },
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
