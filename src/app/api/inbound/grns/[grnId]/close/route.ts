import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

type RouteContext = { params: Promise<{ grnId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await context.params;
    const updated = await inboundGrnsService.closeGrn(grnId, user.email);
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
