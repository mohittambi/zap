import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as warehouseInventoryService from "@/server/services/warehouseInventoryService";

/**
 * @swagger
 * /warehouse_inventory_dump/sku_ids:
 *   get:
 *     summary: Distinct SKUs in the warehouse inventory log
 *     description: Requires warehouse_inventory:read.
 *     tags: [Warehouse Inventory]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "warehouse_inventory", "read");
    const data = await warehouseInventoryService.getWarehouseInventorySkuIds();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
