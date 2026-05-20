import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as analyticsService from "@/server/services/analyticsService";

/**
 * @swagger
 * /listings/analytics/sku/{sku_id}:
 *   get:
 *     summary: Analytics for a SKU
 *     description: Requires analytics:read.
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
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
    assertPermission(user, "analytics", "read");
    const { sku_id } = await context.params;
    const data = await analyticsService.getSkuAnalytics(sku_id);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
