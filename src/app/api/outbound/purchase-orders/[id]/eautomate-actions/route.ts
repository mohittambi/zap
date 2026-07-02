import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  getProductLabelRowsByPoNumber,
  getProductLabelRowsFromSnapshot,
  type SkuReportItemRow,
} from "@/server/services/outboundConsignmentItemsService";
import { buildPhase1BoxLabelsPdf } from "@/server/services/labelPdfService";
import {
  acknowledgeOutboundPo,
  buildOutboundPoListingsPreview,
  cancelOutboundPo,
  extractListingsRowsFromSnapshotNormalized,
  patchOutboundPurchaseOrderField,
  type OutboundPoEditableField,
} from "@/server/services/outboundPurchaseOrdersService";
import {
  enrichOutboundReportRow,
  type OutboundSkuLookups,
} from "@/server/services/eanMappingsService";
import {
  buildPendencyRowsFromListings,
  createOutboundPoPendencyPdf,
  loadPendencyLookups,
} from "@/server/utils/outboundPoPendencyPdf";
import * as outboundPoService from "@/server/services/outboundPurchaseOrdersService";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ACTIONS = new Set([
  "acknowledge",
  "cancel",
  "download_sku_report",
  "preview_listings",
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

function rawStr(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (v == null) return "";
  return String(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parsePercentLike(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const stripped = text.replace(/%/g, "").trim();
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

function firstPresentTaxRate(
  row: Record<string, unknown>,
  fallback?: Record<string, unknown>
): number | null {
  const keys = [
    "tax_rate",
    "gst_rate",
    "igst",
    "igst_percent",
    "gst_percent",
  ] as const;
  for (const key of keys) {
    const parsed = parsePercentLike(row[key]);
    if (parsed != null) return parsed;
    if (fallback) {
      const parsedFallback = parsePercentLike(fallback[key]);
      if (parsedFallback != null) return parsedFallback;
    }
  }
  return null;
}

export function computeSkuReportTaxRatePct(input: {
  explicitTaxRate: unknown;
  explicitTaxRateFallback?: unknown;
  demand: number;
  rateWithoutTax: unknown;
  totalAmount: unknown;
  landingRate: unknown;
}): number | null {
  const explicit = firstPresentTaxRate(
    { tax_rate: input.explicitTaxRate },
    { tax_rate: input.explicitTaxRateFallback }
  );
  if (explicit != null) return round2(Math.max(0, explicit));

  const rateWithoutTax = Number(input.rateWithoutTax);
  const totalAmount = Number(input.totalAmount);
  const demand = Number(input.demand);
  if (
    Number.isFinite(totalAmount) &&
    totalAmount > 0 &&
    Number.isFinite(rateWithoutTax) &&
    rateWithoutTax > 0 &&
    Number.isFinite(demand) &&
    demand > 0
  ) {
    const pct = ((totalAmount / (rateWithoutTax * demand)) - 1) * 100;
    if (Number.isFinite(pct)) {
      const bounded = round2(Math.max(0, pct));
      return bounded <= 100 ? bounded : null;
    }
  }

  const landingRate = Number(input.landingRate);
  if (
    Number.isFinite(landingRate) &&
    landingRate > 0 &&
    Number.isFinite(rateWithoutTax) &&
    rateWithoutTax > 0
  ) {
    const pct = ((landingRate / rateWithoutTax) - 1) * 100;
    if (Number.isFinite(pct)) {
      const bounded = round2(Math.max(0, pct));
      return bounded <= 100 ? bounded : null;
    }
  }

  return null;
}

export function resolveSkuReportMasterSku(
  raw: Record<string, unknown>,
  listObj: Record<string, unknown>,
  item: SkuReportItemRow,
  lookups?: OutboundSkuLookups
): string {
  const row: Record<string, unknown> = {
    ...raw,
    po_secondary_sku: item.po_secondary_sku ?? raw.po_secondary_sku,
    listing: Object.keys(listObj).length ? listObj : raw.listing,
  };
  if (lookups) {
    return enrichOutboundReportRow(row, lookups).master_sku;
  }
  return (
    rawStr(raw, "master_sku") ||
    rawStr(listObj, "master_sku") ||
    rawStr(raw, "inventory_sku_id") ||
    rawStr(listObj, "inventory_sku_id") ||
    ""
  );
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

    /** SKU report: merge consignment ops fields with listings_snapshot commercial data. */
    if (action === "download_sku_report") {
      const reportRows = await outboundPoService.buildSkuReportRowsForPo(po);
      if (reportRows.length > 0) {
        const { buffer, filename } = await outboundPoService.buildSkuReportXlsxFromRows(
          reportRows,
          po
        );
        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
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

    if (action === "preview_listings") {
      const preview = await buildOutboundPoListingsPreview(po);
      if (preview.stats.totalRows === 0) {
        return NextResponse.json(
          {
            error: "No SKU line items found for this purchase order.",
            hint: "Upload the received PO spreadsheet (XLSX/CSV) via the Attachments section, or run `npm run sync:outbound-po-detail` to refresh from eAutomate.",
          },
          { status: 422 }
        );
      }
      return NextResponse.json(preview);
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
      const rows = extractListingsRowsFromSnapshotNormalized(po.listings_snapshot);
      if (rows.length === 0) {
        return NextResponse.json(
          {
            error: "No SKU line items found for this purchase order.",
            hint: "Upload the received PO spreadsheet (XLSX/CSV) via the Attachments section to populate line items.",
          },
          { status: 422 }
        );
      }
      const lookups = await loadPendencyLookups(rows, po.company_id);
      const pendRows = buildPendencyRowsFromListings(rows, lookups);
      const pdfBytes = await createOutboundPoPendencyPdf({
        companyName: po.company_name,
        poNumber: po.po_number,
        deliveryLocation: po.delivery_city,
        expiryDate: po.expiry_date,
        additionDate: po.created_at,
        totalPoQty: outboundPoService.resolvePendencyTotalPoQty(po, rows),
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
      let labelRows = await getProductLabelRowsByPoNumber(
        po.po_number,
        po.company_id
      );
      if (labelRows.length === 0) {
        // Fallback: build from listings_snapshot (enriched with labels_master_data where available)
        const snapshotRows = extractListingsRowsFromSnapshotNormalized(po.listings_snapshot);
        labelRows = await getProductLabelRowsFromSnapshot(
          snapshotRows,
          po.company_id
        );
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
