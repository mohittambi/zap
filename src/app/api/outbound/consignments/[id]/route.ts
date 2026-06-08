import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  getOutboundConsignmentById,
  patchOutboundConsignmentInvoiceNumber,
  patchOutboundConsignmentInvoiceType,
} from "@/server/services/outboundConsignmentsService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/consignments/{id}:
 *   get:
 *     summary: Get consignment by id
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid consignment id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Consignment not found }
 *   patch:
 *     summary: Patch consignment field (invoice_number, invoice_type)
 *     description: Requires purchase_orders:write.
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
 *             required: [field]
 *             properties:
 *               field: { type: string, enum: [invoice_number, invoice_type] }
 *               value: { type: string, nullable: true }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
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
    const row = await getOutboundConsignmentById(id);
    if (!row) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const field = typeof body.field === "string" ? body.field : null;

    if (field === "invoice_number") {
      const raw = body.value;
      const value = typeof raw === "string" ? raw : null;
      await patchOutboundConsignmentInvoiceNumber(id, value, user.email);
      return NextResponse.json({ ok: true });
    }

    if (field === "invoice_type") {
      const raw = body.value;
      const value = typeof raw === "string" ? raw : null;
      await patchOutboundConsignmentInvoiceType(id, value, user.email);
      return NextResponse.json({ ok: true });
    }

    throw new AppError("field must be 'invoice_number' or 'invoice_type'", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
