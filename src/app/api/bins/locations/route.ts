import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getBinLocations } from "@/server/services/binsService";

/**
 * GET /api/bins/locations?sku_id={skuId}
 * Returns all distinct (warehouse_id, bin_id) combinations in the system,
 * annotated with the total units in each bin and how many belong to the
 * requested SKU. Requires bins:read.
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
