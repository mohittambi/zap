import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as purchaseOrdersService from "@/server/services/purchaseOrdersService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { sku_id } = await context.params;
    const data = await purchaseOrdersService.getOutboundOrderSummaryForSku(
      sku_id
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
