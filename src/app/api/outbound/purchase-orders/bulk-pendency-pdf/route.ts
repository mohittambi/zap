import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  buildBulkPendencyPdfMerged,
  buildBulkPendencyPdfZip,
  parseBulkPoIds,
} from "@/server/services/outboundPurchaseOrdersService";

/**
 * @swagger
 * /outbound/purchase-orders/bulk-pendency-pdf:
 *   post:
 *     summary: Build pendency PDFs for multiple outbound PO ids
 *     description: Requires purchase_orders:create. format=zip (per-PO files) or merged (single PDF).
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
 *               format:
 *                 type: string
 *                 enum: [zip, merged]
 *     responses:
 *       200: { description: ZIP or merged PDF file }
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
    const format = String(body.format ?? "zip").trim().toLowerCase();
    if (format !== "zip" && format !== "merged") {
      throw new AppError('format must be "zip" or "merged"', 400);
    }

    const { buffer, filename, skippedPoNumbers } =
      format === "merged"
        ? await buildBulkPendencyPdfMerged(ids)
        : await buildBulkPendencyPdfZip(ids);

    const headers: Record<string, string> = {
      "Content-Type": format === "merged" ? "application/pdf" : "application/zip",
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
