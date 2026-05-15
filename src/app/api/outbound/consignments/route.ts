import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOutboundConsignments } from "@/server/services/outboundConsignmentsService";

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
    const sortBy = typeof q.sort === "string" ? q.sort : undefined;
    const sortDir = q.dir === "asc" ? "asc" : "desc";
    const invoicePending =
      q.pending_invoice === "1" ||
      q.pending_invoice === "true" ||
      q.invoice_pending === "1";

    const data = await listOutboundConsignments({
      page,
      limit,
      search,
      sortBy,
      sortDir,
      invoicePending,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
