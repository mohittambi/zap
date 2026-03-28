import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;
    const wipOnly =
      q.wip === "1" ||
      q.wip === "true" ||
      q.filter === "wip" ||
      q.status === "wip";

    const data = await outboundPoService.listOutboundPurchaseOrders({
      page,
      limit,
      search,
      wipOnly,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
