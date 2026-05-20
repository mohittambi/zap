import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

/**
 * @swagger
 * /inbound/grns:
 *   get:
 *     summary: List GRNs (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - { in: query, name: vendor_id, schema: { type: integer } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: count, schema: { type: integer, default: 100 } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a draft GRN against a PO
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendor_id, po_id]
 *             properties:
 *               vendor_id: { type: integer }
 *               po_id: { type: integer }
 *               vendor_invoice_number: { type: string }
 *               box_count_invoice: { type: integer }
 *               actual_box_count_received: { type: integer }
 *     responses:
 *       201: { description: Created }
 *       400: { description: vendor_id and po_id are required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const vendorId = Number(body.vendor_id);
    const poId = Number(body.po_id);
    if (!Number.isFinite(vendorId) || vendorId < 1 || !Number.isFinite(poId) || poId < 1) {
      throw new AppError("vendor_id and po_id are required", 400);
    }
    const row = await inboundGrnsService.createDraftGrnForPo({
      vendorId,
      poId,
      createdBy: user.email,
      vendorInvoiceNumber: body.vendor_invoice_number,
      boxCountInvoice: body.box_count_invoice,
      actualBoxCountReceived: body.actual_box_count_received,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const vendor_id = q.vendor_id;
    const search_keyword = q.search_keyword ?? "";
    const page = q.page ?? "1";
    const count = q.count ?? "100";

    const data = await inboundGrnsService.listGrnsPaginated({
      vendorId: vendor_id,
      searchKeyword: search_keyword,
      page,
      count,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
