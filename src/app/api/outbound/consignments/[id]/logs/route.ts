import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listOutboundPoLogsByConsignmentId } from "@/server/services/outboundPoLogsService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const rows = await listOutboundPoLogsByConsignmentId(id);
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
