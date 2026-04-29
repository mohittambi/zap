import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "write");
    const { id } = await context.params;
    const body = (await request.json()) as {
      sku_id?: string;
      cost_price?: number | string | null;
    };
    const result = await vendorsService.addVendorListing(
      id,
      body.sku_id,
      body.cost_price,
      user.email
    );
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
