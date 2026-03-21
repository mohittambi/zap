import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";

export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const { sku_id } = await context.params;
    const data = await listingsService.getListingBySku(sku_id);
    if (!data) {
      throw new AppError("SKU not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
