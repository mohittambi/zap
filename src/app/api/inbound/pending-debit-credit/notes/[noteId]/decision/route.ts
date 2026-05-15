import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { decidePendingDebitCreditNote } from "@/server/services/inboundPendingDebitCreditService";

type RouteContext = { params: Promise<{ noteId: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");

    const { noteId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
