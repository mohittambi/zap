/**
 * GET /api/inbound/grns/[grnId]/debit-note/export
 * Downloads a Tally-compatible CSV for the Zap debit note.
 * Marks the debit note as EXPORTED and records exported_at.
 *
 * Requires purchase_orders:read.
 */

import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { buildTallyCsv, markDebitNoteExported } from "@/server/services/grnDebitNoteService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * @swagger
 * /inbound/grns/{grnId}/debit-note/export:
 *   get:
 *     summary: Download Tally-compatible CSV for the debit note
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: CSV file }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Mark debit note as exported
 *     description: Requires purchase_orders:write.
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
 */
export async function GET(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await ctx.params;

    const { csv, filename } = await buildTallyCsv(grnId);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await ctx.params;
    const note = await markDebitNoteExported(grnId);
    const gid = Number(grnId);
    if (Number.isFinite(gid)) {
      await appendInboundGrnLogSafe({
        grnId: gid,
        logType: "DEBIT_NOTE",
        operationPerformed: "Debit note marked exported (Tally)",
        remarks: null,
        createdBy: user.email,
        raw: { exported: true },
      });
    }
    return Response.json(note, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
