import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as labelsService from "@/server/services/labelsService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /labels-master:
 *   get:
 *     summary: Paginated labels master list
 *     description: Requires labels:read.
 *     tags: [Labels]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 500 } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, enum: [sku_asc, sku_desc, created_desc] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "labels", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 500,
    });
    const validSorts = new Set(["sku_asc", "sku_desc", "created_desc"]);
    const sort = validSorts.has(q.sort) ? q.sort : null;
    const data = await labelsService.listLabelsMaster({
      search_keyword: (q.search_keyword || "").trim(),
      page,
      limit,
      sort,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
