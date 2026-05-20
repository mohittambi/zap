import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as warehouseInventoryService from "@/server/services/warehouseInventoryService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /warehouse_inventory_dump/sku_id/by_page/{sku_id}:
 *   get:
 *     summary: Warehouse inventory dump for a SKU (paginated)
 *     description: Requires warehouse_inventory:read.
 *     tags: [Warehouse Inventory]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 200, maximum: 200 } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "warehouse_inventory", "read");
    const { sku_id } = await context.params;
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 200,
      maxLimit: 200,
    });
    const data = await warehouseInventoryService.getWarehouseInventoryBySku(
      sku_id,
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
