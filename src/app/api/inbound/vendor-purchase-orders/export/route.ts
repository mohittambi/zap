import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorPoService from "@/server/services/vendorPurchaseOrdersService";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @swagger
 * /inbound/vendor-purchase-orders/export:
 *   get:
 *     summary: Export vendor purchase orders as CSV
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: query
 *         name: vendor_id
 *         required: true
 *         schema: { type: integer }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *     responses:
 *       200: { description: CSV file }
 *       400: { description: vendor_id required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const vendorId = u.searchParams.get("vendor_id");
    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id query parameter is required" },
        { status: 400 }
      );
    }
    const search_keyword = u.searchParams.get("search_keyword") ?? "";

    const rows = await vendorPoService.listVendorPurchaseOrdersAll({
      vendorId,
      searchKeyword: search_keyword,
    });

    const headers = [
      "po_id",
      "vendor_id",
      "expected_date",
      "status",
      "po_remarks",
      "sku_count",
      "total_quantity",
      "number_of_grns",
      "total_invoice_quantity",
      "total_accepted_quantity",
      "total_rejected_quantity",
      "sku_fill_rate",
      "quantity_fill_rate",
      "date_published",
      "created_by",
      "created_at",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.po_id,
          r.vendor_id,
          r.expected_date,
          r.status,
          r.po_remarks,
          r.sku_count,
          r.total_quantity,
          r.number_of_grns,
          r.total_invoice_quantity,
          r.total_accepted_quantity,
          r.total_rejected_quantity,
          r.sku_fill_rate,
          r.quantity_fill_rate,
          r.date_published,
          r.created_by,
          r.created_at,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vendor_${vendorId}_purchase_orders.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
