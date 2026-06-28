import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * @swagger
 * /inbound/grns/{grnId}/close:
 *   post:
 *     summary: Close a GRN
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await context.params;
    const updated = await inboundGrnsService.closeGrn(grnId, user.email);
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "grn_closed",
      resource: "inbound_grns",
      resourceId: String(grnId),
      statusCode: 200,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
