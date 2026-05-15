import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_PATCH_FIELDS = new Set<outboundPoService.OutboundPoEditableField>([
  "po_type",
  "delivery_city",
  "delivery_address",
  "billing_address",
  "expiry_date",
  "remarks",
  "is_wip",
]);

export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const field = body.field as string;
    if (!field || !ALLOWED_PATCH_FIELDS.has(field as outboundPoService.OutboundPoEditableField)) {
      throw new AppError(`field must be one of: ${[...ALLOWED_PATCH_FIELDS].join(", ")}`, 400);
    }
    const raw = body.value;
    const value = typeof raw === "string" ? raw : null;
    await outboundPoService.patchOutboundPurchaseOrderField(
      id,
      field as outboundPoService.OutboundPoEditableField,
      value
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const { deleted } = await outboundPoService.deleteOutboundPartialPurchaseOrderById(id);
    if (!deleted) {
      return NextResponse.json(
        {
          error:
            "Only draft or partially created purchase orders can be deleted, or PO was not found.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
