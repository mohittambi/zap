import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = { params: Promise<{ grnId: string }> };

/**
 * Promote a Zap-created draft (status DRAFT_ZAP) to OPEN, keeping the existing
 * grn_id. Use this when ops doesn't have a separate warehouse / receipt GRN
 * number — the zap-allocated id (sequence-based, ZG-N) becomes the operational
 * id directly.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await context.params;

    const updated = await inboundGrnsService.openDraftGrn(grnId);

    await appendInboundGrnLogSafe({
      grnId: updated.grn_id,
      logType: "STATUS",
      operationPerformed: "Draft promoted to OPEN",
      remarks: "Operational id is the zap-allocated sequence id (no re-key).",
      createdBy: user.email,
      raw: { transition: "DRAFT_ZAP -> OPEN" },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
