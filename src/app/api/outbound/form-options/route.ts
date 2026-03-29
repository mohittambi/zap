import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const [soldVia, companies] = await Promise.all([
      outboundPoService.listOutboundSoldViaOptions(),
      outboundPoService.listOutboundCompaniesForForm(),
    ]);
    return NextResponse.json({
      soldVia,
      companies,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
