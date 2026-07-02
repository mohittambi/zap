import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  buildBulkSkuReportXlsx,
  parseBulkPoIds,
} from "@/server/services/outboundPurchaseOrdersService";

/**
 * @swagger
 * /outbound/purchase-orders/bulk-sku-report:
 *   post:
 *     summary: Build merged SKU Level Report XLSX for multiple outbound PO ids
 *     description: Requires purchase_orders:create. Merges all line items into one workbook.
 *     tags: [Outbound]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200: { description: Merged XLSX file }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: PO not found }
 *       422: { description: No line items }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const ids = parseBulkPoIds(body.ids);
    const { buffer, filename, skippedPoNumbers } = await buildBulkSkuReportXlsx(ids);
    const headers: Record<string, string> = {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    };
    if (skippedPoNumbers.length > 0) {
      headers["X-Skipped-Po-Numbers"] = skippedPoNumbers.join(",");
    }
    return new Response(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    return handleApiError(err);
  }
}
