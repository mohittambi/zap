import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getConsignmentLineRowsForEditor } from "@/server/services/outboundConsignmentItemsService";

type Ctx = { params: Promise<{ id: string }> };

/** Line-item drafts from PO listings or saved consignment lines. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const payload = await getConsignmentLineRowsForEditor(id);
    return NextResponse.json(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
