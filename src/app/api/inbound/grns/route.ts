import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const vendorId = Number(body.vendor_id);
    const poId = Number(body.po_id);
    if (!Number.isFinite(vendorId) || vendorId < 1 || !Number.isFinite(poId) || poId < 1) {
      throw new AppError("vendor_id and po_id are required", 400);
    }
    const row = await inboundGrnsService.createDraftGrnForPo({
      vendorId,
      poId,
      createdBy: user.email,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const vendor_id = q.vendor_id;
    const search_keyword = q.search_keyword ?? "";
    const page = q.page ?? "1";
    const count = q.count ?? "100";

    const data = await inboundGrnsService.listGrnsPaginated({
      vendorId: vendor_id,
      searchKeyword: search_keyword,
      page,
      count,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
