import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { eautomateConfigured } from "@/server/eautomate-proxy";
import { syncOutboundPurchaseOrderDetailFromEautomate } from "@/server/services/eautomateOutboundPoDetailSyncService";
import {
  getOutboundConsignmentItemsByPoNumber,
  getSkuReportItemsByPoNumber,
  type SkuReportItemRow,
} from "@/server/services/outboundConsignmentItemsService";
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

function phase1ItemsToCsv(
  rows: Awaited<ReturnType<typeof getOutboundConsignmentItemsByPoNumber>>
): string {
  const headers = [
    "consignment_id",
    "po_secondary_sku",
    "company_code_primary",
    "company_code_secondary",
    "box_number",
    "box_name",
    "box_quantity",
    "mrp",
    "original_demand",
    "dispatched_quantity",
    "consignment_quantity",
    "overall_fill_rate",
  ] as const;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers.map((h) => csvEscapeCell(csvCell(row[h]))).join(",")
    );
  }
  return `\ufeff${lines.join("\n")}`;
}

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
      if (eautomateConfigured()) {
        await syncOutboundPurchaseOrderDetailFromEautomate(po.po_number).catch(
          () => undefined
        );
      }
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
      // No consignment items — try syncing listings_snapshot from eAutomate, then check again.
      if (eautomateConfigured()) {
        await syncOutboundPurchaseOrderDetailFromEautomate(pn).catch(() => undefined);
      }
      const fresh = (await outboundPoService.getOutboundPurchaseOrderById(id)) ?? po;
      const snapshotRows = extractListingsRowsFromSnapshot(fresh.listings_snapshot);
      if (snapshotRows.length > 0) {
        const csv = outboundPoListingsSnapshotToCsv(fresh.listings_snapshot, fresh);
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
          hint: "Upload the received PO spreadsheet (XLSX/CSV) via the Attachments section to populate line items, or wait for the PO to be synced from eAutomate once SKUs are entered.",
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
      return NextResponse.json({
        ok: true,
        action,
        po,
        rows,
      });
    }

    if (action === "generate_phase1_box_labels") {
      const items = await getOutboundConsignmentItemsByPoNumber(po.po_number);
      const csv = phase1ItemsToCsv(items);
      const fname = `phase1-box-labels-${safeFilename(po.po_number)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fname}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}
