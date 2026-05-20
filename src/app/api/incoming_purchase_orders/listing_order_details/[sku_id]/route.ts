import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as purchaseOrdersService from "@/server/services/purchaseOrdersService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /incoming_purchase_orders/listing_order_details/{sku_id}:
 *   get:
 *     summary: Listing order details by SKU (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Incoming Purchase Orders]
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
    assertPermission(user, "purchase_orders", "read");
    const { sku_id } = await context.params;
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 200,
      maxLimit: 200,
    });
    const data = await purchaseOrdersService.getListingOrderDetailsBySku(
      sku_id,
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
