import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  getSkuReportItemsByPoNumber,
  getProductLabelRowsByPoNumber,
  getProductLabelRowsFromSnapshot,
  type SkuReportItemRow,
} from "@/server/services/outboundConsignmentItemsService";
import { buildPhase1BoxLabelsPdf } from "@/server/services/labelPdfService";
import {
  acknowledgeOutboundPo,
  cancelOutboundPo,
  extractListingsRowsFromSnapshot,
  outboundPoListingsSnapshotToCsv,
  patchOutboundPurchaseOrderField,
  type OutboundPoRow,
  type OutboundPoEditableField,
} from "@/server/services/outboundPurchaseOrdersService";
import {
  buildPendencyRowsFromListings,
  createOutboundPoPendencyPdf,
} from "@/server/utils/outboundPoPendencyPdf";
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

const EDITABLE_FIELDS = new Set<OutboundPoEditableField>([
  "po_type",
  "delivery_city",
  "delivery_address",
  "billing_address",
  "expiry_date",
  "remarks",
  "is_wip",
]);

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function csvEscapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

const SKU_REPORT_COLS = [
  "buyer_name",
  "po_number",
  "po_release_date",
  "po_expiry_date",
  "po_addition_date",
  "po_type",
  "delivery_location",
  "po_secondary_sku",
  "master_sku",
  "inventory_sku_id",
  "pack_combo_sku_id",
  "sku_type",
  "company_code_primary",
  "company_code_secondary",
  "title",
  "mrp",
  "rate_without_tax",
  "tax_rate",
  "hsn",
  "size",
  "color",
  "ops_tag",
  "warehouse_quantity",
  "demand",
  "packed",
  "dispatched",
  "pending",
  "fill_rate_percent",
] as const;

function rawStr(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (v == null) return "";
  return String(v);
}

function rawNum(raw: Record<string, unknown>, key: string): number | null {
  const v = raw[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build SKU report CSV from `outbound_consignment_items` rows (deduped by SKU).
 * PO-header fields (buyer_name, po_number, dates, type, delivery) come from the PO row.
 * Per-SKU fields come from the denormalized columns + the rich `raw` JSONB.
 */
function skuReportFromConsignmentItems(
  items: SkuReportItemRow[],
  po: OutboundPoRow
): string {
  const header = SKU_REPORT_COLS.join(",");
  if (items.length === 0) {
    return `\ufeff${header}\n`;
  }
  const lines: string[] = [header];
  for (const item of items) {
    const raw = item.raw;
    const listing = raw.listing;
    const listObj =
      listing && typeof listing === "object" && !Array.isArray(listing)
        ? (listing as Record<string, unknown>)
        : {};

    const demand = rawNum(raw, "demand") ?? item.original_demand ?? 0;
    const dispatched =
      rawNum(raw, "dispatched_quantity") ?? item.dispatched_quantity ?? 0;
    const packed = item.consignment_quantity ?? 0;
    const pending = demand - (packed + dispatched);

    const warehouseQty =
      rawNum(listObj, "available_quantity") ??
      (rawStr(listObj, "available_quantity") !== ""
        ? Number(listObj.available_quantity) || null
        : null);

    const cells: string[] = [
      csvEscapeCell(csvCell(po.company_name ?? rawStr(raw, "buyer_name"))),
      csvEscapeCell(csvCell(po.po_number)),
      csvEscapeCell(csvCell(po.po_issue_date)),
      csvEscapeCell(csvCell(po.expiry_date)),
      csvEscapeCell(csvCell(rawStr(raw, "created_at") || po.created_at)),
      csvEscapeCell(csvCell(po.po_type ?? rawStr(raw, "po_type"))),
      csvEscapeCell(csvCell(po.delivery_city)),
      csvEscapeCell(csvCell(item.po_secondary_sku ?? rawStr(raw, "po_secondary_sku"))),
      csvEscapeCell(csvCell(rawStr(raw, "master_sku") || rawStr(listObj, "master_sku"))),
      csvEscapeCell(csvCell(rawStr(raw, "inventory_sku_id") || rawStr(listObj, "inventory_sku_id"))),
      csvEscapeCell(csvCell(rawStr(raw, "pack_combo_sku_id") || rawStr(listObj, "pack_combo_sku_id"))),
      csvEscapeCell(csvCell(rawStr(raw, "sku_type") || rawStr(listObj, "sku_type"))),
      csvEscapeCell(csvCell(item.company_code_primary ?? rawStr(raw, "company_code_primary"))),
      csvEscapeCell(csvCell(item.company_code_secondary ?? rawStr(raw, "company_code_secondary"))),
      csvEscapeCell(csvCell(rawStr(raw, "title"))),
      csvEscapeCell(csvCell(item.mrp ?? rawStr(raw, "mrp"))),
      csvEscapeCell(csvCell(rawStr(raw, "rate_without_tax"))),
      csvEscapeCell(csvCell(rawStr(raw, "tax_rate"))),
      csvEscapeCell(csvCell(rawStr(raw, "hsn_code") || rawStr(raw, "hsn"))),
      csvEscapeCell(csvCell(rawStr(raw, "size") || rawStr(listObj, "size"))),
      csvEscapeCell(csvCell(rawStr(raw, "color") || rawStr(listObj, "color"))),
      csvEscapeCell(csvCell(rawStr(raw, "ops_tag") || rawStr(listObj, "ops_tag"))),
      csvEscapeCell(csvCell(warehouseQty)),
      csvEscapeCell(csvCell(demand)),
      csvEscapeCell(csvCell(packed)),
      csvEscapeCell(csvCell(dispatched)),
      csvEscapeCell(csvCell(pending)),
      csvEscapeCell(
        csvCell(item.overall_fill_rate ?? (rawStr(raw, "fill_rate_percent") || rawStr(raw, "fill_rate")))
      ),
    ];
    lines.push(cells.join(","));
  }
  return `\ufeff${lines.join("\n")}`;
}

/**
 * @swagger
 * /outbound/purchase-orders/{id}/eautomate-actions:
 *   post:
 *     summary: Run an eAutomate action on a PO (acknowledge, cancel, save field, reports, labels)
 *     description: Requires purchase_orders:create.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [acknowledge, cancel, download_sku_report, download_pendency_pdf, generate_product_labels, generate_phase1_box_labels, save_field]
 *               field: { type: string }
 *               value: { type: string, nullable: true }
 *               startBox: { type: integer }
 *               endBox: { type: integer }
 *               labelSize: { type: string, enum: [70x40, 75x38] }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: PO not found }
 *       422: { description: No SKU line items for this PO }
 */
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
      const field = String(body.field ?? "").trim() as OutboundPoEditableField;
      if (!field || !EDITABLE_FIELDS.has(field)) {
        return NextResponse.json(
          { error: "save_field requires a valid field", allowed: [...EDITABLE_FIELDS] },
          { status: 400 }
        );
      }
      const rawVal = body.value;
      const value =
        rawVal == null
          ? null
          : typeof rawVal === "string"
            ? rawVal
            : String(rawVal);
      await patchOutboundPurchaseOrderField(id, field, value);
      /** No inline sync-back to eAutomate; run `npm run sync:outbound-po-detail` separately. */
      return NextResponse.json({ ok: true });
    }

    /** SKU report: primary source = outbound_consignment_items (raw JSONB), fallback = listings_snapshot. */
    if (action === "download_sku_report") {
      const pn = po.po_number;
      const skuItems = await getSkuReportItemsByPoNumber(pn);
      if (skuItems.length > 0) {
        const csv = skuReportFromConsignmentItems(skuItems, po);
        const fname = `sku-report-${safeFilename(pn)}.csv`;
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fname}"`,
          },
        });
      }
      /** No inline eAutomate sync; fall back to the locally-cached listings_snapshot. */
      const snapshotRows = extractListingsRowsFromSnapshot(po.listings_snapshot);
      if (snapshotRows.length > 0) {
        const csv = outboundPoListingsSnapshotToCsv(po.listings_snapshot, po);
        const fname = `sku-report-${safeFilename(pn)}.csv`;
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fname}"`,
          },
        });
      }
      return NextResponse.json(
        {
          error: "No SKU line items found for this purchase order.",
          hint: "Run `npm run sync:outbound-po-detail` to refresh from eAutomate, or upload the received PO spreadsheet (XLSX/CSV) via the Attachments section to populate line items.",
        },
        { status: 422 }
      );
    }

    if (action === "acknowledge") {
      await acknowledgeOutboundPo(id);
      const updated = await outboundPoService.getOutboundPurchaseOrderById(id);
      return NextResponse.json({ ok: true, action, po: updated ?? po });
    }

    if (action === "cancel") {
      await cancelOutboundPo(id);
      const updated = await outboundPoService.getOutboundPurchaseOrderById(id);
      return NextResponse.json({ ok: true, action, po: updated ?? po });
    }

    if (action === "download_pendency_pdf") {
      const rows = extractListingsRowsFromSnapshot(po.listings_snapshot);
      if (rows.length === 0) {
        return NextResponse.json(
          {
            error: "No SKU line items found for this purchase order.",
            hint: "Upload the received PO spreadsheet (XLSX/CSV) via the Attachments section to populate line items.",
          },
          { status: 422 }
        );
      }
      const pendRows = buildPendencyRowsFromListings(rows);
      const pdfBytes = await createOutboundPoPendencyPdf({
        companyName: po.company_name,
        poNumber: po.po_number,
        deliveryLocation: po.delivery_city,
        rows: pendRows,
      });
      const fname = `pendency-${safeFilename(po.po_number)}.pdf`;
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    if (action === "generate_product_labels") {
      let labelRows = await getProductLabelRowsByPoNumber(po.po_number);
      if (labelRows.length === 0) {
        // Fallback: build from listings_snapshot (enriched with labels_master_data where available)
        const snapshotRows = extractListingsRowsFromSnapshot(po.listings_snapshot);
        labelRows = await getProductLabelRowsFromSnapshot(snapshotRows);
      }
      if (labelRows.length === 0) {
        return NextResponse.json(
          {
            error: "No SKU line items found for this purchase order.",
            hint: "Sync the PO detail from eAutomate or upload a received PO spreadsheet to populate line items.",
          },
          { status: 422 }
        );
      }
      return NextResponse.json({ ok: true, action, rows: labelRows });
    }

    if (action === "generate_phase1_box_labels") {
      const startBox = Number.parseInt(String(body.startBox ?? ""), 10);
      const endBox = Number.parseInt(String(body.endBox ?? ""), 10);
      const labelSize = body.labelSize === "75x38" ? "75x38" : "70x40";
      if (
        !Number.isFinite(startBox) ||
        !Number.isFinite(endBox) ||
        startBox < 1 ||
        endBox < startBox
      ) {
        return NextResponse.json(
          {
            error: "Invalid box-number range.",
            hint: "Provide valid startBox and endBox values where startBox <= endBox.",
          },
          { status: 400 }
        );
      }
      const companyInfo = [po.company_name, po.delivery_city]
        .filter((v) => String(v ?? "").trim().length > 0)
        .join(", ");
      const pdfBytes = await buildPhase1BoxLabelsPdf(
        startBox,
        endBox,
        companyInfo,
        labelSize
      );
      const fname = `phase1-${safeFilename(po.po_number)}-${startBox}-${endBox}.pdf`;
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}
