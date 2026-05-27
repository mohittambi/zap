import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { isOutboundPoAcknowledged } from "@/lib/outbound-po-acknowledgement";
import { isOutboundPoWip } from "@/lib/outbound-po-wip";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import { previewOutboundConsignmentPacking } from "@/server/services/outboundConsignmentPackingPreview";
import { parseConsignmentPackingSpreadsheet } from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";

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

/**
 * Preview bin packing rows for a new consignment on this PO (before consignment exists).
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }
    const poNumber = po.po_number != null ? String(po.po_number).trim() : "";
    if (!poNumber) {
      return NextResponse.json({ error: "PO has no po_number" }, { status: 400 });
    }

    if (!isOutboundPoWip(po.is_wip)) {
      return NextResponse.json(
        {
          error:
            "PO must be marked WIP before previewing consignment packing. Set WIP status to Y on the PO Details tab.",
        },
        { status: 400 }
      );
    }

    if (!isOutboundPoAcknowledged(po.po_acknowledgement_status)) {
      return NextResponse.json(
        {
          error:
            "PO must be acknowledged before previewing consignment packing. Use Acknowledge Purchase Order on the PO detail page.",
        },
        { status: 400 }
      );
    }

    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
    let parsedRows: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ParsedConsignmentPackingRow[] =
      [];
    let parseErrors: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ConsignmentPackingParseError[] =
      [];

    if (contentType.includes("application/json")) {
      const json = (await request.json()) as { rows?: unknown };
      if (!Array.isArray(json.rows)) {
        return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
      }
      for (const item of json.rows) {
        if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
        const o = item as Record<string, unknown>;
        const rowNumber = Number(o.rowNumber ?? o.row_number ?? 0);
        const box_number = Number(o.box_number ?? o.binNumber);
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
            message: "Invalid row — check Bin Number, Bin Name, Item Code, and Quantity",
          });
          continue;
        }
        parsedRows.push({
          rowNumber:
            Number.isFinite(rowNumber) && rowNumber > 0
              ? Math.trunc(rowNumber)
              : parsedRows.length + 2,
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

    const result = await previewOutboundConsignmentPacking({
      outboundPoId: id,
      poNumber,
      rows: parsedRows,
      parseErrors,
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
