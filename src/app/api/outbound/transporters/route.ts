import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listOutboundTransporters } from "@/server/services/outboundConsignmentItemsService";

/**
 * @swagger
 * /outbound/transporters:
 *   get:
 *     summary: Outbound transporter directory
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const rows = await listOutboundTransporters();
    return NextResponse.json({ content: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
