import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  getInsightConfig,
  patchInsightConfig,
} from "@/server/services/insightConfigService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const config = await getInsightConfig();
    return NextResponse.json(config);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const body = (await request.json()) as Record<string, unknown>;
    const fields: Record<string, number | boolean> = {};
    const numericKeys = [
      "severity_weight_critical",
      "severity_weight_warning",
      "severity_weight_info",
      "stockout_cover_days",
      "dead_stock_days",
      "ordering_cost_default",
      "holding_cost_pct_default",
    ] as const;
    for (const key of numericKeys) {
      if (key in body && typeof body[key] === "number") {
        fields[key] = body[key] as number;
      }
    }
    if ("digest_enabled" in body && typeof body.digest_enabled === "boolean") {
      fields.digest_enabled = body.digest_enabled;
    }
    if (Object.keys(fields).length === 0) {
      throw new AppError("No valid fields to update", 400);
    }
    const updated = await patchInsightConfig(fields);
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
