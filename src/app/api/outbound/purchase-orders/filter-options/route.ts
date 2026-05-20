import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

/**
 * @swagger
 * /outbound/purchase-orders/filter-options:
 *   get:
 *     summary: Filter options for outbound POs (companies, delivery locations)
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
    const [companies, deliveryLocations] = await Promise.all([
      outboundPoService.listOutboundCompaniesForForm(),
      outboundPoService.listOutboundDeliveryLocationsForForm(),
    ]);
    return NextResponse.json({ companies, deliveryLocations });
  } catch (err) {
    return handleApiError(err);
  }
}
