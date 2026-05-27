import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";
import {
  applyConsignmentPackingUpload,
  validateConsignmentPackingRows,
} from "@/server/services/outboundConsignmentItemsService";
import {
  extractListingsRowsFromSnapshot,
  getOutboundPurchaseOrderByPoNumber,
} from "@/server/services/outboundPurchaseOrdersService";
import type { ParsedConsignmentPackingRow } from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";
import { query } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

type ApplyBody = {
  mode?: unknown;
  rows?: unknown;
};

function parseApplyBody(raw: ApplyBody): {
  mode: "append" | "replace";
  rows: ParsedConsignmentPackingRow[];
} {
  const mode = raw.mode === "replace" ? "replace" : "append";
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    throw new AppError("rows must be a non-empty array", 400);
  }
  const rows: ParsedConsignmentPackingRow[] = [];
  for (const item of raw.rows) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const rowNumber = Number(o.rowNumber);
    const box_number = Number(o.box_number);
    const box_name = typeof o.box_name === "string" ? o.box_name.trim() : "";
    const po_secondary_sku =
      typeof o.po_secondary_sku === "string" ? o.po_secondary_sku.trim() : "";
    const quantity = Number(o.quantity);
    if (
      !Number.isFinite(rowNumber) ||
      !Number.isFinite(box_number) ||
      box_number < 1 ||
      !box_name ||
      !po_secondary_sku ||
      !Number.isFinite(quantity) ||
      quantity < 1
    ) {
      continue;
    }
    rows.push({
      rowNumber: Math.trunc(rowNumber),
      box_number: Math.trunc(box_number),
      box_name,
      po_secondary_sku,
      quantity: Math.trunc(quantity),
      company_code_primary:
        typeof o.company_code_primary === "string"
          ? o.company_code_primary.trim() || null
          : null,
      company_code_secondary:
        typeof o.company_code_secondary === "string"
          ? o.company_code_secondary.trim() || null
          : null,
    });
  }
  if (rows.length === 0) {
    throw new AppError("No valid rows to apply", 400);
  }
  return { mode, rows };
}

async function knownSkusForConsignment(
  consignmentId: number,
  poNumber: string
): Promise<{ poSkus: Set<string>; consignmentSkus: Set<string> }> {
  const poSkus = new Set<string>();
  const consignmentSkus = new Set<string>();

  const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
  if (po?.listings_snapshot) {
    for (const row of extractListingsRowsFromSnapshot(po.listings_snapshot)) {
      const sku = row.po_secondary_sku ?? row.item_code ?? row.sku;
      if (sku != null && String(sku).trim()) {
        poSkus.add(String(sku).trim());
      }
    }
  }

  const items = await query(
    `SELECT DISTINCT po_secondary_sku FROM outbound_consignment_items WHERE consignment_id = $1`,
    [consignmentId]
  );
  for (const row of items.rows) {
    const sku = row.po_secondary_sku;
    if (sku != null && String(sku).trim()) {
      consignmentSkus.add(String(sku).trim());
    }
  }

  return { poSkus, consignmentSkus };
}

/**
 * @swagger
 * /outbound/consignments/{id}/packing-upload/apply:
 *   post:
 *     summary: Apply consignment bin packing upload
 *     description: Requires purchase_orders:write.
 *     tags: [Outbound]
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
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
        { error: "Consignment has no po_number; cannot apply bin packing" },
        { status: 400 }
      );
    }

    const json = (await request.json()) as ApplyBody;
    const { mode, rows } = parseApplyBody(json);
    const { poSkus, consignmentSkus } = await knownSkusForConsignment(id, poNumber);
    const validation = await validateConsignmentPackingRows({
      consignmentId: id,
      poNumber,
      rows,
      parseErrors: [],
      knownPoSkus: poSkus,
      knownConsignmentSkus: consignmentSkus,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const result = await applyConsignmentPackingUpload({
      consignmentId: id,
      poNumber,
      rows,
      mode,
      createdBy: user.email,
    });

    return NextResponse.json({
      ok: true,
      mode,
      inserted: result.inserted,
      deleted: result.deleted,
      binsAffected: result.binsAffected,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
