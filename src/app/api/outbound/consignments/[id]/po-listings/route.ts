import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { enrichListingsSnapshotWithZapEan } from "@/server/services/eanMappingsService";
import {
  enrichListingsSnapshotWithListingImages,
  getOutboundPurchaseOrderByPoNumber,
} from "@/server/services/outboundPurchaseOrdersService";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

/** PO line items (listings snapshot) for the consignment's linked purchase order. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const consignment = await getOutboundConsignmentById(id);
    if (!consignment) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }

    const poNumber =
      consignment.po_number != null ? String(consignment.po_number).trim() : "";
    if (!poNumber) {
      return NextResponse.json(
        { error: "Consignment has no linked PO number" },
        { status: 400 }
      );
    }

    const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found for this consignment" },
        { status: 404 }
      );
    }

    const snapshot =
      po.listings_snapshot && typeof po.listings_snapshot === "object"
        ? po.listings_snapshot
        : {};
    const withEan = await enrichListingsSnapshotWithZapEan(snapshot, po.company_id);
    const listings = await enrichListingsSnapshotWithListingImages(withEan);

    return NextResponse.json({
      outboundPoId: po.id,
      poNumber: po.po_number,
      poStatus: po.calculated_po_status ?? null,
      poType: po.po_type ?? null,
      listings,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
