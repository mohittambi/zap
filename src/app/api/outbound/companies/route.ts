import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOutboundCompaniesPaginated } from "@/server/services/outboundPurchaseOrdersService";

/** Paginated outbound company directory — powers mobile `GET /api/outbound/companies`. */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;

    const data = await listOutboundCompaniesPaginated({
      page,
      limit,
      search,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
