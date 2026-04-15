import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ACTIONS = new Set([
  "acknowledge",
  "cancel",
  "download_sku_report",
  "download_pendency_pdf",
  "generate_product_labels",
  "generate_phase1_box_labels",
  "save_field",
]);

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await outboundPoService.getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = String(body.action ?? "").trim();
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Unknown or missing action", allowed: [...ALLOWED_ACTIONS] },
        { status: 400 }
      );
    }

    if (action === "save_field") {
      const field = String(body.field ?? "").trim();
      if (!field) {
        return NextResponse.json({ error: "save_field requires field" }, { status: 400 });
      }
    }

    return NextResponse.json(
      {
        error: "Not implemented",
        message:
          "This eAutomate workflow is not wired in Zap yet. Capture the Network request from eCraft and map it here.",
        action,
        po_number: po.po_number,
      },
      { status: 501 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
