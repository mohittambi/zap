import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { mergeInboundPoRaw } from "@/server/services/inboundPoZapActionsService";

type Ctx = { params: Promise<{ id: string; poId: string }> };

/**
 * @swagger
 * /inbound/vendors/{id}/purchase-orders/{poId}/modify:
 *   patch:
 *     summary: Update zap_notes on an inbound PO
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [zap_notes]
 *             properties:
 *               zap_notes: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const notes =
      typeof body.zap_notes === "string" ? body.zap_notes.trim() : "";
    if (!notes) {
      throw new AppError("zap_notes is required", 400);
    }

    await mergeInboundPoRaw(vendorId, poIdNum, {
      zap_notes: notes,
      zap_modified_at: new Date().toISOString(),
      zap_modified_by: user.email,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
