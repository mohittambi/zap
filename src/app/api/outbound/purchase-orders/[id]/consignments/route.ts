import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import { listOutboundConsignments } from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

/** Consignments for one outbound PO — filters `outbound_consignments` by `po_number`. */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;
    const sortBy = typeof q.sort === "string" ? q.sort : undefined;
    const sortDir = q.dir === "asc" ? "asc" : "desc";

    const data = await listOutboundConsignments({
      page,
      limit,
      poNumber: po.po_number,
      search,
      sortBy,
      sortDir,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
