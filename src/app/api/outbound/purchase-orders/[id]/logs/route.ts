import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getOutboundPurchaseOrderById } from "@/server/services/outboundPurchaseOrdersService";
import { listOutboundPoLogs } from "@/server/services/outboundPoLogsService";

type Ctx = { params: Promise<{ id: string }> };

/** zap DB only. Logs are populated by `npm run sync:outbound-po-detail`. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireAuth(_request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid PO id" }, { status: 400 });
    }

    const po = await getOutboundPurchaseOrderById(id);
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const logs = await listOutboundPoLogs(id);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
