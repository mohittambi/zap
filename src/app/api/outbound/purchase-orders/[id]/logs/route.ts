import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import { listOutboundPoLogs } from "@/server/services/outboundPoLogsService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/purchase-orders/{id}/logs:
 *   get:
 *     summary: Activity logs for an outbound PO
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid PO id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: PO not found }
 */
/** zap DB only. Logs are populated by `npm run sync:outbound-po-detail`. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const logs = await listOutboundPoLogs(id);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
