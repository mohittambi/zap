import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  buildInboundPoPdfBytes,
  buildInboundPoXlsxBytes,
} from "@/server/services/inboundPoZapActionsService";

type Ctx = { params: Promise<{ id: string; poId: string }> };

const PDF_MIME = "application/pdf";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * @swagger
 * /inbound/vendors/{id}/purchase-orders/{poId}/document:
 *   get:
 *     summary: Download inbound PO as PDF or XLSX
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
 *       - { in: query, name: format, schema: { type: string, enum: [pdf, xlsx, excel], default: pdf } }
 *     responses:
 *       200: { description: Binary file }
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

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "pdf").toLowerCase();
    const isXlsx = format === "xlsx" || format === "excel";

    const { bytes, filename } = isXlsx
      ? await buildInboundPoXlsxBytes(vendorId, poIdNum)
      : await buildInboundPoPdfBytes(vendorId, poIdNum);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": isXlsx ? XLSX_MIME : PDF_MIME,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
