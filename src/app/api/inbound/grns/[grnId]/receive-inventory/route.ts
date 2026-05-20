/**
 * POST /api/inbound/grns/[grnId]/receive-inventory
 * Books accepted GRN quantities into bins (per-SKU bin mapping).
 * Requires accounts_status='APPROVED' on the GRN.
 * Requires purchase_orders:write.
 *
 * Body: { items: [{ sku_id, bin_id, quantity }] }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { receiveIntoInventory } from "@/server/services/grnInventoryReceiptService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * @swagger
 * /inbound/grns/{grnId}/receive-inventory:
 *   post:
 *     summary: Book GRN quantities into bins
 *     description: Requires purchase_orders:write. GRN must be accounts-approved.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sku_id: { type: string }
 *                     bin_id: { type: string }
 *                     quantity: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await ctx.params;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      throw new AppError("Request body must contain an items array", 400);
    }

    const results = await receiveIntoInventory(grnId, body.items, user.email);
    const gid = Number(grnId);
    if (Number.isFinite(gid)) {
      await appendInboundGrnLogSafe({
        grnId: gid,
        logType: "INVENTORY",
        operationPerformed: "Inventory booked from GRN receipt",
        remarks: `${body.items.length} allocation(s)`,
        createdBy: user.email,
        raw: {
          itemCount: body.items.length,
          results: results.slice(0, 100).map((r) => ({
            sku_id: r.sku_id,
            bin_id: r.bin_id,
            quantity: r.quantity,
            new_quantity: r.new_quantity,
          })),
        },
      });
    }
    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
