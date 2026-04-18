import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { eautomateConfigured } from "@/server/eautomate-proxy";
import { parsePagination } from "@/server/validators/pagination";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "@/server/services/eautomateOutboundPoDetailSyncService";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Paginated PO line items from `listings_snapshot` (same source as web line-items table).
 * Triggers eAutomate sync when configured so mobile does not need to open PO detail first.
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;

    let po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (eautomateConfigured()) {
      const syncResult = await syncOutboundPurchaseOrderDetailFromEautomate(po.po_number);
      if (syncResult.ok) {
        po = (await outboundPoService.getOutboundPurchaseOrderById(id)) ?? po;
      }
    }

    const snapshot = po.listings_snapshot;
    const payload = outboundPoService.buildOutboundPoItemsPayloadFromSnapshot(snapshot, {
      page,
      limit,
      search,
    });

    return NextResponse.json(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
