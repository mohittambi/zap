import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = {
  params: Promise<{ grnId: string; lineIndex: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId, lineIndex } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await inboundGrnsService.updateInboundGrnItemRaw(
      grnId,
      lineIndex,
      body
    );
    const gid = Number(grnId);
    const li = Number(lineIndex);
    if (Number.isFinite(gid) && Number.isFinite(li)) {
      await appendInboundGrnLogSafe({
        grnId: gid,
        logType: "LINE",
        operationPerformed: `GRN line ${li} updated`,
        remarks: "Quantities and/or prices saved",
        createdBy: user.email,
        raw: { line_index: li },
      });
    }
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
