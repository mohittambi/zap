import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { buildBulkOutboundConsignmentInvoiceExcel } from "@/server/services/outboundConsignmentsService";

/**
 * @swagger
 * /outbound/consignments/bulk-invoice-excel:
 *   post:
 *     summary: Build merged outbound consignment invoice XLSX for multiple ids
 *     description: Requires purchase_orders:read. Each consignment must have an invoice number assigned.
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
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawIds = body.ids;
    if (!Array.isArray(rawIds)) {
      throw new AppError("ids must be an array", 400);
    }
    const ids = rawIds.map((v) => Number(v));
    const { buffer, filename } = await buildBulkOutboundConsignmentInvoiceExcel(ids);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
