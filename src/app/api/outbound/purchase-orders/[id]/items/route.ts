import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/purchase-orders/{id}/items:
 *   get:
 *     summary: Paginated outbound PO line items
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid PO id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: PO not found }
 */
/**
 * Paginated PO line items from zap's `listings_snapshot` column.
 * zap DB only. Sync from eAutomate is run via `npm run sync:outbound-po-detail`.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;

    const po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const payload = outboundPoService.buildOutboundPoItemsPayloadFromSnapshot(
      po.listings_snapshot,
      { page, limit, search }
    );

    return NextResponse.json(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
