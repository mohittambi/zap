import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError, AppError } from "@/server/errors";
import { upsertReorderConfig } from "@/server/services/reorderService";

// PUT /api/reorder/config/[skuId]
// Body: { lead_time_days: number; use_advanced: boolean }
export async function PUT(
  request: Request,
  { params }: { params: { skuId: string } }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "write");

    const body = (await request.json()) as Record<string, unknown>;
    const leadTime = Number(body.lead_time_days);
    if (!Number.isInteger(leadTime) || leadTime < 1 || leadTime > 365) {
      throw new AppError("lead_time_days must be an integer between 1 and 365", 400);
    }
    const useAdvanced = Boolean(body.use_advanced);

    const config = await upsertReorderConfig(params.skuId, {
      lead_time_days: leadTime,
      use_advanced: useAdvanced,
    });
    return NextResponse.json(config);
  } catch (err) {
    return handleApiError(err);
  }
}
