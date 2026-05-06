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
} from "@/server/services/grnDebitNoteService";

type RouteContext = { params: Promise<{ grnId: string }> };

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

    const note = await generateDebitNote(grnId, user.email);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
