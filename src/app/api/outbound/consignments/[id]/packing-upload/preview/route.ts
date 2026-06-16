import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getOutboundConsignmentById } from "@/server/services/outboundConsignmentsService";
import {
  validateConsignmentPackingRows,
} from "@/server/services/outboundConsignmentItemsService";
import {
  extractListingsRowsFromSnapshotNormalized,
  getOutboundPurchaseOrderByPoNumber,
} from "@/server/services/outboundPurchaseOrdersService";
import { parseConsignmentPackingSpreadsheet } from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";
import { query } from "@/server/db";

const MAX_BYTES = 2 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

function isSpreadsheet(file: File): boolean {
  const lower = file.name.toLowerCase();
  const mt = (file.type || "").toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.includes("spreadsheet") ||
    mt.includes("csv") ||
    mt.includes("excel") ||
    mt.includes("sheet")
  );
}

async function knownSkusForConsignment(
  consignmentId: number,
  poNumber: string
): Promise<{ poSkus: Set<string>; consignmentSkus: Set<string> }> {
  const poSkus = new Set<string>();
  const consignmentSkus = new Set<string>();

  const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
  if (po?.listings_snapshot) {
    for (const row of extractListingsRowsFromSnapshotNormalized(po.listings_snapshot)) {
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
 * /outbound/consignments/{id}/packing-upload/preview:
 *   post:
 *     summary: Preview consignment bin packing CSV/XLSX upload
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
        { error: "Consignment has no po_number; cannot upload bin packing" },
        { status: 400 }
      );
    }

    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
    let parsedRows: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ParsedConsignmentPackingRow[] = [];
    let parseErrors: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ConsignmentPackingParseError[] = [];

    if (contentType.includes("application/json")) {
      const json = (await request.json()) as { rows?: unknown };
      if (!Array.isArray(json.rows)) {
        return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
      }
      for (const item of json.rows) {
        if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
        const o = item as Record<string, unknown>;
        const rowNumber = Number(o.rowNumber ?? o.row_number ?? 0);
        const box_number = Number(o.box_number ?? o.binNumber ?? o.bin_number);
        const box_name =
          typeof o.box_name === "string"
            ? o.box_name.trim()
            : typeof o.binName === "string"
              ? o.binName.trim()
              : "";
        const po_secondary_sku =
          typeof o.po_secondary_sku === "string"
            ? o.po_secondary_sku.trim()
            : typeof o.itemCode === "string"
              ? o.itemCode.trim()
              : "";
        const quantity = Number(o.quantity ?? o.box_quantity);
        if (
          !Number.isFinite(box_number) ||
          box_number < 1 ||
          !box_name ||
          !po_secondary_sku ||
          !Number.isFinite(quantity) ||
          quantity < 1
        ) {
          parseErrors.push({
            row: Number.isFinite(rowNumber) && rowNumber > 0 ? Math.trunc(rowNumber) : 0,
            field: "Row",
            message: "Invalid manual row — check Bin Number, Bin Name, Item Code, and Quantity",
          });
          continue;
        }
        parsedRows.push({
          rowNumber: Number.isFinite(rowNumber) && rowNumber > 0 ? Math.trunc(rowNumber) : parsedRows.length + 2,
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
      if (parsedRows.length === 0 && parseErrors.length === 0) {
        return NextResponse.json({ error: "No valid rows provided" }, { status: 400 });
      }
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      if (!isSpreadsheet(file)) {
        return NextResponse.json(
          { error: "Only CSV or Excel spreadsheets are supported" },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File must be 2MB or smaller" }, { status: 400 });
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const parsed = parseConsignmentPackingSpreadsheet(buf, file.name);
      parsedRows = parsed.rows;
      parseErrors = parsed.errors;
    }

    const { poSkus, consignmentSkus } = await knownSkusForConsignment(id, poNumber);
    const result = await validateConsignmentPackingRows({
      consignmentId: id,
      poNumber,
      rows: parsedRows,
      parseErrors,
      knownPoSkus: poSkus,
      knownConsignmentSkus: consignmentSkus,
    });

    return NextResponse.json({
      ok: result.ok,
      rowsPreview: result.rowsPreview,
      binSummary: result.binSummary,
      errors: result.errors,
      warnings: result.warnings,
      stats: result.stats,
      rows: result.rows,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
