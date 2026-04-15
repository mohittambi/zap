import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { syncOutboundCompaniesFromPublicApi } from "@/server/services/eautomateOutboundCompaniesSync";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const forceSync =
      u.searchParams.get("refresh") === "1" || u.searchParams.get("sync") === "1";

    const companySync = await syncOutboundCompaniesFromPublicApi({ force: forceSync });

    const [soldVia, companies] = await Promise.all([
      outboundPoService.listOutboundSoldViaOptions(),
      outboundPoService.listOutboundCompaniesForForm(),
    ]);
    return NextResponse.json({
      soldVia,
      companies,
      companySync,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
