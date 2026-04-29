import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorPoService from "@/server/services/vendorPurchaseOrdersService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const search_keyword = q.search_keyword ?? "";
    const page = q.page ?? "1";
    const count = q.count ?? "100";

    const vendorIds = (q.vendor_ids ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);

    const data = await vendorPoService.listAllPurchaseOrdersWithFilters({
      searchKeyword: search_keyword,
      page,
      count,
      filterPoId: q.po_id_filter,
      filterVendorIds: vendorIds.length ? vendorIds : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
