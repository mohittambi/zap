import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { decidePendingDebitCreditNote } from "@/server/services/inboundPendingDebitCreditService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = { params: Promise<{ noteId: string }> };

/**
 * @swagger
 * /inbound/pending-debit-credit/notes/{noteId}/decision:
 *   post:
 *     summary: Decide on a pending debit/credit note
 *     description: Requires purchase_orders:write and admin role for Accept/Decline decisions.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [grn_id, status]
 *             properties:
 *               grn_id: { type: integer }
 *               status: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");

    const { noteId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (!user.roles.includes("admin")) {
      const grnIdForLog =
        typeof body.grn_id === "string" || typeof body.grn_id === "number"
          ? Number(body.grn_id)
          : NaN;
      if (Number.isFinite(grnIdForLog) && grnIdForLog !== 0) {
        await appendInboundGrnLogSafe({
          grnId: grnIdForLog,
          logType: "DCN_DECISION_DENIED",
          operationPerformed: "Debit/credit note accept/decline attempt blocked — not an admin",
          createdBy: user.email,
          raw: {
            note_id: noteId,
            attempted_status: body.status,
            user_roles: user.roles,
          },
        });
      }
      throw new AppError("Admin role required to accept or decline debit/credit notes", 403);
    }

    const grnId = body.grn_id;
    const status = body.status;

    const grnIdText =
      typeof grnId === "string" || typeof grnId === "number"
        ? String(grnId).trim()
        : "";
    if (grnIdText === "") {
      throw new AppError("grn_id is required", 400);
    }
    if (typeof status !== "string" || status.trim() === "") {
      throw new AppError("status is required", 400);
    }

    const updated = await decidePendingDebitCreditNote({
      noteId,
      grnId: grnIdText,
      status,
      actorEmail: user.email,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
