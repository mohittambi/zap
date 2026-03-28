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
    const vendorId = u.searchParams.get("vendor_id");
    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id query parameter is required" },
        { status: 400 }
      );
    }
    const search_keyword = u.searchParams.get("search_keyword") ?? "";
    const page = u.searchParams.get("page") ?? "1";
    const count = u.searchParams.get("count") ?? "100";

    const data = await vendorPoService.listVendorPurchaseOrdersWithFilters({
      vendorId,
      searchKeyword: search_keyword,
      page,
      count,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const body = (await request.json()) as Record<string, unknown>;
    const created = await vendorPoService.createVendorPurchaseOrder(
      body,
      user.email
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
