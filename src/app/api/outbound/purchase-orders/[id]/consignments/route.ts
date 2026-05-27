import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { isOutboundPoAcknowledged } from "@/lib/outbound-po-acknowledgement";
import { isOutboundPoWip } from "@/lib/outbound-po-wip";
import { parsePagination } from "@/server/validators/pagination";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import {
  createOutboundConsignmentInZap,
  listOutboundConsignments,
} from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/purchase-orders/{id}/consignments:
 *   get:
 *     summary: List consignments for an outbound PO
 *   post:
 *     summary: Create empty consignment in Zap (line items entered on consignment detail)
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

/** Create empty consignment in Zap (PO must be WIP and acknowledged). */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (!isOutboundPoWip(po.is_wip)) {
      return NextResponse.json(
        {
          error:
            "PO must be marked WIP before creating a consignment. Set WIP status to Y on the PO Details tab.",
        },
        { status: 400 }
      );
    }

    if (!isOutboundPoAcknowledged(po.po_acknowledgement_status)) {
      return NextResponse.json(
        {
          error:
            "PO must be acknowledged before creating a consignment. Use Acknowledge Purchase Order on the PO detail page.",
        },
        { status: 400 }
      );
    }

    const result = await createOutboundConsignmentInZap({
      outboundPoId: id,
      po,
      createdBy: user.email,
    });

    return NextResponse.json({
      ok: true,
      consignment: { id: result.id },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
