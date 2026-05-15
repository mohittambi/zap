import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getBinChanges } from "@/server/services/binsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const result = await getBinChanges({
      sku_id: searchParams.get("sku_id") ?? undefined,
      bin_id: searchParams.get("bin_id") ?? undefined,
      movement_type: searchParams.get("movement_type") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
