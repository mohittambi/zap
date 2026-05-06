/**
 * POST /api/inbound/grns/[grnId]/receive-inventory
 * Books accepted GRN quantities into bins (per-SKU bin mapping).
 * Requires accounts_status='APPROVED' on the GRN.
 * Requires purchase_orders:write.
 *
 * Body: { items: [{ sku_id, bin_id, quantity }] }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { receiveIntoInventory } from "@/server/services/grnInventoryReceiptService";

type RouteContext = { params: Promise<{ grnId: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await ctx.params;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      throw new AppError("Request body must contain an items array", 400);
    }

    const results = await receiveIntoInventory(grnId, body.items, user.email);
    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
