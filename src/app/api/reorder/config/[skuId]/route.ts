import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { upsertReorderConfig } from "@/server/services/reorderService";

/**
 * @swagger
 * /reorder/config/{skuId}:
 *   put:
 *     summary: Upsert reorder config for a SKU
 *     description: Requires bins:write.
 *     tags: [Reorder]
 *     parameters:
 *       - in: path
 *         name: skuId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lead_time_days, use_advanced]
 *             properties:
 *               lead_time_days: { type: integer, minimum: 1, maximum: 365 }
 *               use_advanced: { type: boolean }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
// PUT /api/reorder/config/[skuId]
// Body: { lead_time_days: number; use_advanced: boolean }
export async function PUT(
  request: Request,
  context: { params: Promise<{ skuId: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "write");
    const { skuId } = await context.params;

    const body = (await request.json()) as Record<string, unknown>;
    const leadTime = Number(body.lead_time_days);
    if (!Number.isInteger(leadTime) || leadTime < 1 || leadTime > 365) {
      throw new AppError("lead_time_days must be an integer between 1 and 365", 400);
    }
    const useAdvanced = Boolean(body.use_advanced);

    const config = await upsertReorderConfig(skuId, {
      lead_time_days: leadTime,
      use_advanced: useAdvanced,
    });
    return NextResponse.json(config);
  } catch (err) {
    return handleApiError(err);
  }
}
