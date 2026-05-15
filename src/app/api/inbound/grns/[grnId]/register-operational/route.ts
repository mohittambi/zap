import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";
import { appendInboundGrnLogSafe } from "@/server/services/inboundGrnLogService";

type RouteContext = { params: Promise<{ grnId: string }> };

function parseOperationalGrnId(body: Record<string, unknown>): number | null {
  const v = body?.operational_grn_id;
  let raw = typeof v === "number" ? v : null;
  if (typeof v === "string") {
    const trimmed = String(v).trim();
    if (!trimmed) return null;
    raw = Number(trimmed);
  }
  if (raw === null || !Number.isFinite(raw)) return null;
  const rounded = Math.floor(raw as number);
  return rounded >= 1 ? rounded : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId: draftGrnId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const operationalGrnId = parseOperationalGrnId(body);
    if (operationalGrnId === null) {
      throw new AppError(
        "Body must include operational_grn_id (positive integer)",
        400
      );
    }

    const updated = await inboundGrnsService.registerOperationalGrnId(
      draftGrnId,
      operationalGrnId
    );
    const draftNum = Number(draftGrnId);
    await appendInboundGrnLogSafe({
      grnId: operationalGrnId,
      logType: "GRN",
      operationPerformed: "Operational GRN id registered",
      remarks: `Draft ${Number.isFinite(draftNum) ? draftNum : draftGrnId} → GRN ${operationalGrnId}`,
      createdBy: user.email,
      raw: { draft_grn_id: draftNum, operational_grn_id: operationalGrnId },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
