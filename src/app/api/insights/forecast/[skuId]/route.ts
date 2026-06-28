import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getSkuForecastBundle } from "@/server/services/insightsForecastService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";

type RouteContext = { params: Promise<{ skuId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const { skuId } = await context.params;
    if (!skuId?.trim()) throw new AppError("skuId is required", 400);
    const bundle = await getSkuForecastBundle(decodeURIComponent(skuId));
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "forecast_run",
      resource: "insights",
      resourceId: decodeURIComponent(skuId),
      statusCode: 200,
    });
    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}
