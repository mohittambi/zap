import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildOutboundConsignmentInvoiceExcel } from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/consignments/{id}/invoice-excel:
 *   get:
 *     summary: Build outbound consignment invoice XLSX
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: XLSX file }
 *       400: { description: Invalid consignment id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }
    const { buffer, filename } = await buildOutboundConsignmentInvoiceExcel(id);
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
