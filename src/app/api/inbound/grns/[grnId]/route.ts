import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

const AUDIT_TERMINAL = new Set(["CLOSED", "AUDITED", "DONE", "COMPLETED"]);

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * @swagger
 * /inbound/grns/{grnId}:
 *   get:
 *     summary: Get GRN header by id
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   patch:
 *     summary: Update GRN status fields (audit / invoice-collection / accounts)
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               grn_audit_status: { type: string }
 *               grn_audit_by: { type: string }
 *               grn_invoice_collection_status: { type: string }
 *               grn_invoice_collection_by: { type: string }
 *               grn_status: { type: string }
 *               accounts_status: { type: string }
 *               accounts_by: { type: string }
 *               original_invoice_date: { type: string, nullable: true, description: "YYYY-MM-DD or null to clear" }
 *     responses:
 *       200: { description: OK }
 *       400: { description: No valid fields to update }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await context.params;
    const row = await inboundGrnsService.getGrnById(grnId);
    return NextResponse.json(row);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const allowed = ["grn_audit_status", "grn_audit_by", "grn_invoice_collection_status", "grn_invoice_collection_by", "grn_status", "accounts_status", "accounts_by", "original_invoice_date"] as const;
    const fields: Record<string, string | null> = {};
    for (const key of allowed) {
      if (key in body) {
        const val = body[key];
        if (key === "original_invoice_date") {
          fields[key] = val == null ? null : typeof val === "string" ? val.trim() || null : null;
        } else {
          fields[key] = typeof val === "string" ? val.trim() || null : null;
        }
      }
    }
    if (Object.keys(fields).length === 0) {
      throw new AppError("No valid fields to update", 400);
    }

    const auditVal = String(fields.grn_audit_status ?? "").trim().toUpperCase();
    if (AUDIT_TERMINAL.has(auditVal) && !user.roles.includes("admin")) {
      const gid = Number(grnId);
      if (Number.isFinite(gid) && gid !== 0) {
        await appendInboundGrnLogSafe({
          grnId: gid,
          logType: "AUDIT_DENIED",
          operationPerformed: "Mark-audited attempt blocked — not an admin",
          createdBy: user.email,
          raw: { attempted_value: auditVal, user_roles: user.roles },
        });
      }
      throw new AppError("Admin role required to mark GRN as audited", 403);
    }

    const updated = await inboundGrnsService.updateGrnStatus(grnId, fields, user.email);
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
