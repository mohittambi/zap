import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { getReorderMetricForSku } from "@/server/services/reorderService";

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
