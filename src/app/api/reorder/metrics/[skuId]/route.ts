import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { getReorderMetricForSku } from "@/server/services/reorderService";

/**
 * @swagger
 * /reorder/metrics/{skuId}:
 *   get:
 *     summary: Reorder metric for a SKU
 *     description: Requires bins:read.
 *     tags: [Reorder]
 *     parameters:
 *       - in: path
 *         name: skuId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: SKU not found }
 */
// GET /api/reorder/metrics/[skuId]
export async function GET(
  request: Request,
  context: { params: Promise<{ skuId: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const { skuId } = await context.params;
    const metric = await getReorderMetricForSku(skuId);
    if (!metric) throw new AppError("SKU not found", 404);
    return NextResponse.json(metric);
  } catch (err) {
    return handleApiError(err);
  }
}
