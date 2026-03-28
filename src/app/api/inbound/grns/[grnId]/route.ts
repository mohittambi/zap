import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

type RouteContext = { params: Promise<{ grnId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await context.params;
    const row = await inboundGrnsService.getGrnById(grnId);
    return NextResponse.json(row);
  } catch (err) {
    return handleApiError(err);
  }
}
