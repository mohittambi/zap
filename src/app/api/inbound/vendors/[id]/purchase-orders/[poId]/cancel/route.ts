import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  assertVendorPoSnapshot,
  mergeInboundPoRaw,
} from "@/server/services/inboundPoZapActionsService";

type Ctx = { params: Promise<{ id: string; poId: string }> };

/**
 * @swagger
 * /inbound/vendors/{id}/purchase-orders/{poId}/cancel:
 *   patch:
 *     summary: Cancel an inbound PO (mark zap_status=CANCELLED)
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: poId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid vendor or PO id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id, poId } = await context.params;
    const vendorId = Number(id);
    const poIdNum = Number(poId);
    if (!Number.isFinite(vendorId) || vendorId < 1 || !Number.isFinite(poIdNum) || poIdNum < 1) {
      return NextResponse.json({ message: "Invalid vendor or PO id" }, { status: 400 });
    }

    const { po_raw } = await assertVendorPoSnapshot(vendorId, poIdNum);
    const cur = String(po_raw.zap_status ?? "").trim().toUpperCase();
    if (cur === "CANCELLED") {
      return NextResponse.json({ ok: true });
    }

    await mergeInboundPoRaw(vendorId, poIdNum, {
      zap_status: "CANCELLED",
      zap_cancelled_at: new Date().toISOString(),
      zap_cancelled_by: user.email,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
