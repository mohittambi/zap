import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getSkuForecastBundle } from "@/server/services/insightsForecastService";

type RouteContext = { params: Promise<{ skuId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "insights", "read");
    const { skuId } = await context.params;
    if (!skuId?.trim()) throw new AppError("skuId is required", 400);
    const bundle = await getSkuForecastBundle(decodeURIComponent(skuId));
    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}
