import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getBinLocations } from "@/server/services/binsService";

/**
 * @swagger
 * /bins/locations:
 *   get:
 *     summary: All bin locations annotated with totals for a SKU
 *     description: Requires bins:read.
 *     tags: [Bins]
 *     parameters:
 *       - in: query
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: sku_id is required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const skuId = new URL(request.url).searchParams.get("sku_id");
    if (!skuId?.trim()) {
      throw new AppError("sku_id query param is required", 400);
    }
    const data = await getBinLocations(skuId);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
