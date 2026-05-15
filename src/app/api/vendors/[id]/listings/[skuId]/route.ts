import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; skuId: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "vendors", "write");
    const { id, skuId } = await context.params;
    const decoded = decodeURIComponent(skuId);
    const result = await vendorsService.removeVendorListing(id, decoded);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
