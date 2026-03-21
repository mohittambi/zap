import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "read");
    const { sku_id } = await context.params;
    const data = await vendorsService.getVendorsBySku(sku_id);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
