import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inventoryService from "@/server/services/inventoryService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /inventory/secondary_listings/packs_and_combos/paginated:
 *   get:
 *     summary: Paginated packs & combos listings
 *     description: Requires inventory:read.
 *     tags: [Inventory]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 1000, maximum: 1000 } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, enum: [sku_asc, sku_desc] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "inventory", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const search_keyword = (q.search_keyword || "").trim();
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 1000,
      maxLimit: 1000,
    });
    const sortRaw = q.sort ?? "";
    const sort = sortRaw === "sku_desc" ? "sku_desc" : sortRaw === "sku_asc" ? "sku_asc" : null;
    const data = await inventoryService.getPacksAndCombosPaginated(
      search_keyword,
      page,
      limit,
      { sort }
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
