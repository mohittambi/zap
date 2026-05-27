import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import type { ConsignmentSkuPacking } from "@/lib/outbound-consignment-line-drafts";
import { saveConsignmentLineItems } from "@/server/services/outboundConsignmentItemsService";
import { query } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

function parseSkusFromBody(raw: unknown): ConsignmentSkuPacking[] {
  if (!Array.isArray(raw)) {
    throw new AppError("skus must be a non-empty array", 400);
  }
  const skus: ConsignmentSkuPacking[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const boxesRaw = Array.isArray(o.boxes) ? o.boxes : [];
    const boxes = boxesRaw.map((b) => {
      const box = b as Record<string, unknown>;
      return {
        box_number: Math.trunc(Number(box.box_number ?? 0)),
        box_quantity: Math.trunc(Number(box.box_quantity ?? 0)),
        box_name: typeof box.box_name === "string" ? box.box_name.trim() : "",
      };
    });
    skus.push({
      po_secondary_sku:
        typeof o.po_secondary_sku === "string" ? o.po_secondary_sku.trim() : "",
      inventory_sku_id:
        typeof o.inventory_sku_id === "string" ? o.inventory_sku_id.trim() : "",
      company_code_primary:
        typeof o.company_code_primary === "string" ? o.company_code_primary.trim() : "",
      demand_quantity: Number(o.demand_quantity ?? 0),
      dispatched_quantity: Number(o.dispatched_quantity ?? 0),
      reserved_quantity: Number(o.reserved_quantity ?? 0),
      pending_quantity: Number(o.pending_quantity ?? 0),
      boxes,
    });
  }
  if (skus.length === 0) {
    throw new AppError("At least one SKU is required", 400);
  }
  return skus;
}

/** Replace all consignment line items after validation. */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const consignmentId = Number(idStr);
    if (!Number.isFinite(consignmentId) || consignmentId < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const cR = await query(
      `SELECT po_number FROM outbound_consignments WHERE id = $1`,
      [consignmentId]
    );
    if (cR.rows.length === 0) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }
    const poNumber =
      cR.rows[0]?.po_number != null ? String(cR.rows[0].po_number).trim() : "";
    if (!poNumber) {
      return NextResponse.json({ error: "Consignment has no po_number" }, { status: 400 });
    }

    const json = (await request.json()) as { skus?: unknown };
    const skus = parseSkusFromBody(json.skus);

    const result = await saveConsignmentLineItems({
      consignmentId,
      poNumber,
      skus,
      createdBy: user.email,
    });

    return NextResponse.json({ ok: true, inserted: result.inserted });
  } catch (err) {
    return handleApiError(err);
  }
}
