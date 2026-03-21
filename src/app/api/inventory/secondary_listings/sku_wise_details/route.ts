import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as inventoryService from "@/server/services/inventoryService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "inventory", "read");
    const u = new URL(request.url);
    const secondary_sku = (
      u.searchParams.get("secondary_sku") ||
      u.searchParams.get("sku") ||
      ""
    ).trim();
    if (!secondary_sku) {
      throw new AppError("secondary_sku or sku query param required", 400);
    }
    const data = await inventoryService.getSkuWiseDetails(secondary_sku);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
