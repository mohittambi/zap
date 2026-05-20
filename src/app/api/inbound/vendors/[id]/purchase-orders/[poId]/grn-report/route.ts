import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildGrnReportCsv } from "@/server/services/inboundPoZapActionsService";

type Ctx = { params: Promise<{ id: string; poId: string }> };

/**
 * @swagger
 * /inbound/vendors/{id}/purchase-orders/{poId}/grn-report:
 *   get:
 *     summary: GRN report CSV for an inbound PO
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: poId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: CSV file }
 *       400: { description: Invalid vendor or PO id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id, poId } = await context.params;
    const vendorId = Number(id);
    const poIdNum = Number(poId);
    if (!Number.isFinite(vendorId) || vendorId < 1 || !Number.isFinite(poIdNum) || poIdNum < 1) {
      return NextResponse.json({ message: "Invalid vendor or PO id" }, { status: 400 });
    }

    const { csv, filename } = await buildGrnReportCsv(vendorId, poIdNum);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
