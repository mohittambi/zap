/**
 * GET /api/inventory/secondary_listings/logs?secondary_sku=X
 * Returns the last 50 change history entries for a secondary SKU.
 * Requires secondary_listings:read.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getLogsForSku } from "@/server/services/secondaryListingsLogsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "read");

    const url = new URL(request.url);
    const secondary_sku = url.searchParams.get("secondary_sku")?.trim() ?? "";
    if (!secondary_sku) {
      throw new AppError("secondary_sku is required", 400);
    }

    const logs = await getLogsForSku(secondary_sku);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
