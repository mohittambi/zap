import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildConsignmentPoLineItemsView } from "@/server/services/outboundConsignmentPoLineItemsService";

type Ctx = { params: Promise<{ id: string }> };

/** PO line items for consignment: Zap snapshot + this consignment's packed qty. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const view = await buildConsignmentPoLineItemsView(id);
    if (!view) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch (err) {
    return handleApiError(err);
  }
}
