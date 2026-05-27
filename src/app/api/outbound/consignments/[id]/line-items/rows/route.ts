import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listConsignmentLineItemRowsFlat } from "@/server/services/outboundConsignmentItemsService";
import { query } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Flat consignment line rows for post-RTD tab views. */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const consignmentId = Number(idStr);
    if (!Number.isFinite(consignmentId) || consignmentId < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const cR = await query(`SELECT id FROM outbound_consignments WHERE id = $1`, [
      consignmentId,
    ]);
    if (cR.rows.length === 0) {
      return NextResponse.json({ error: "Consignment not found" }, { status: 404 });
    }

    const rows = await listConsignmentLineItemRowsFlat(consignmentId);
    return NextResponse.json({ rows });
  } catch (err) {
    return handleApiError(err);
  }
}
