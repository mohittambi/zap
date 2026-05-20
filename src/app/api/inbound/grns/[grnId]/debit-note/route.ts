/**
 * GET  /api/inbound/grns/[grnId]/debit-note — fetch existing Zap debit note + lines
 * POST /api/inbound/grns/[grnId]/debit-note — (re)generate debit note from price diff
 *
 * Requires purchase_orders:read (GET) / purchase_orders:write (POST).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  getDebitNoteForGrn,
  generateDebitNote,
  getAuditPreview,
  assignDnNumber,
  closeDnDemand,
  assignDcnNumberForGrn,
} from "@/server/services/grnDebitNoteService";

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * @swagger
 * /inbound/grns/{grnId}/debit-note:
 *   get:
 *     summary: Fetch debit note (or audit preview with ?preview=1)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: preview
 *         schema: { type: string, enum: ["1"] }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Generate (or regenerate) debit note
 *     description: Requires purchase_orders:write.
 *     tags: [Inbound]
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force_regenerate: { type: boolean }
 *     responses:
 *       201: { description: Created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   patch:
 *     summary: Close DN demand, assign DN/DCN number
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
 *               close: { type: boolean }
 *               dcn_number: { type: string }
 *               dn_number: { type: string }
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

    const url = new URL(request.url);
    if (url.searchParams.get("preview") === "1") {
      const lines = await getAuditPreview(grnId);
      return NextResponse.json({ lines });
    }

    const note = await getDebitNoteForGrn(grnId);
    return NextResponse.json(note);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await ctx.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const forceRegenerate = body.force_regenerate === true;

    const note = await generateDebitNote(grnId, user.email, {
      forceRegenerate,
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await ctx.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (body.close === true) {
      const note = await closeDnDemand(grnId, user.email);
      return NextResponse.json(note);
    }

    const dcnNumber = typeof body.dcn_number === "string" ? body.dcn_number.trim() : "";
    if (dcnNumber) {
      const updated = await assignDcnNumberForGrn(grnId, dcnNumber, user.email);
      return NextResponse.json(updated);
    }

    const dnNumber = typeof body.dn_number === "string" ? body.dn_number.trim() : "";
    const note = await assignDnNumber(grnId, dnNumber, user.email);
    return NextResponse.json(note);
  } catch (err) {
    return handleApiError(err);
  }
}
