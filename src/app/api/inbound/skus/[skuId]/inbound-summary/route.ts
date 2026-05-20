import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { query } from "@/server/db";

type RouteContext = { params: Promise<{ skuId: string }> };

const SKU_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function parseJsonbNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "null") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @swagger
 * /inbound/skus/{skuId}/inbound-summary:
 *   get:
 *     summary: Inbound summary for a SKU (vendor billing + closed GRNs)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: skuId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid sku id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const { skuId: rawSkuId } = await context.params;
    const skuId = decodeURIComponent(rawSkuId ?? "").trim();
    if (!skuId || !SKU_ID_RE.test(skuId)) {
      return NextResponse.json({ message: "Invalid sku id" }, { status: 400 });
    }

    const vendorBillingR = await query(
      `WITH lines AS (
         SELECT
           g.vendor_id,
           g.vendor_name::text AS vendor_name,
           g.grn_id,
           COALESCE(s.grn_created_at, g.created_at) AS ordered_at,
           COALESCE(NULLIF(trim(i.raw->>'accepted_quantity'), '')::numeric, 0)::numeric AS accepted_qty,
           CASE
             WHEN trim(COALESCE(i.raw->>'received_price', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
             THEN trim(i.raw->>'received_price')::numeric
           END AS recv_price
         FROM inbound_grn_items i
         INNER JOIN inbound_grns g ON g.grn_id = i.grn_id
         LEFT JOIN inbound_grn_detail_snapshot s ON s.grn_id = g.grn_id
         WHERE i.sku_id = $1
           AND UPPER(TRIM(COALESCE(g.grn_audit_status, ''))) = 'CLOSED'
           AND UPPER(TRIM(COALESCE(g.grn_status, ''))) = 'CLOSED'
       ),
       agg AS (
         SELECT
           vendor_id,
           MAX(vendor_name) AS vendor_name,
           COUNT(DISTINCT grn_id) AS bill_count,
           SUM(accepted_qty) AS total_qty_received,
           MIN(recv_price) AS min_price,
           MAX(recv_price) AS max_price
         FROM lines
         GROUP BY vendor_id
       ),
       latest AS (
         SELECT DISTINCT ON (vendor_id)
           vendor_id,
           recv_price AS latest_price
         FROM lines
         WHERE recv_price IS NOT NULL
         ORDER BY vendor_id, ordered_at DESC NULLS LAST
       )
       SELECT
         a.vendor_id,
         a.vendor_name,
         a.total_qty_received,
         a.bill_count,
         a.min_price,
         a.max_price,
         l.latest_price
       FROM agg a
       LEFT JOIN latest l ON l.vendor_id = a.vendor_id
       ORDER BY a.vendor_id ASC`,
      [skuId]
    );

    const closedR = await query(
      `SELECT
         g.grn_id,
         g.vendor_name::text AS vendor_name,
         g.vendor_invoice_number::text AS invoice_number,
         COALESCE(s.grn_created_at, g.created_at) AS grn_date,
         CASE
           WHEN trim(COALESCE(i.raw->>'invoice_quantity', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN trim(i.raw->>'invoice_quantity')::numeric
         END AS invoice_qty,
         CASE
           WHEN trim(COALESCE(i.raw->>'accepted_quantity', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN trim(i.raw->>'accepted_quantity')::numeric
         END AS accepted_qty,
         CASE
           WHEN trim(COALESCE(i.raw->>'rejected_quantity', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN trim(i.raw->>'rejected_quantity')::numeric
         END AS rejected_qty,
         CASE
           WHEN trim(COALESCE(i.raw->>'received_price', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN trim(i.raw->>'received_price')::numeric
         END AS received_price,
         CASE
           WHEN trim(COALESCE(i.raw->>'audit_price', '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
           THEN trim(i.raw->>'audit_price')::numeric
         END AS audit_price
       FROM inbound_grn_items i
       INNER JOIN inbound_grns g ON g.grn_id = i.grn_id
       LEFT JOIN inbound_grn_detail_snapshot s ON s.grn_id = g.grn_id
       WHERE i.sku_id = $1
         AND UPPER(TRIM(COALESCE(g.grn_audit_status, ''))) = 'CLOSED'
         AND UPPER(TRIM(COALESCE(g.grn_status, ''))) = 'CLOSED'
       ORDER BY COALESCE(s.grn_created_at, g.created_at) DESC NULLS LAST, g.grn_id DESC
       LIMIT 30`,
      [skuId]
    );

    const vendor_billing = vendorBillingR.rows.map((row: Record<string, unknown>) => ({
      vendor_id: Number(row.vendor_id),
      vendor_name: row.vendor_name != null ? String(row.vendor_name) : null,
      total_qty_received: parseJsonbNum(row.total_qty_received) ?? 0,
      bill_count: Number(row.bill_count) || 0,
      min_price: parseJsonbNum(row.min_price),
      max_price: parseJsonbNum(row.max_price),
      latest_price: parseJsonbNum(row.latest_price),
    }));

    const closed_grn_summary = closedR.rows.map((row: Record<string, unknown>) => ({
      grn_id: Number(row.grn_id),
      vendor_name: row.vendor_name != null ? String(row.vendor_name) : null,
      invoice_number: row.invoice_number != null ? String(row.invoice_number) : null,
      grn_date: row.grn_date != null ? String(row.grn_date) : null,
      invoice_qty: parseJsonbNum(row.invoice_qty),
      accepted_qty: parseJsonbNum(row.accepted_qty),
      rejected_qty: parseJsonbNum(row.rejected_qty),
      received_price: parseJsonbNum(row.received_price),
      audit_price: parseJsonbNum(row.audit_price),
    }));

    return NextResponse.json({
      sku_id: skuId,
      vendor_billing,
      closed_grn_summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
