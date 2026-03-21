import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as purchaseOrdersService from "@/server/services/purchaseOrdersService";
import { parsePagination } from "@/server/validators/pagination";

export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { sku_id } = await context.params;
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 200,
      maxLimit: 200,
    });
    const data = await purchaseOrdersService.getListingOrderDetailsBySku(
      sku_id,
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
