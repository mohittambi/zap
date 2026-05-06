import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "write");
    const { grnId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const allowed = ["grn_audit_status", "grn_audit_by", "grn_invoice_collection_status", "grn_invoice_collection_by", "grn_status", "accounts_status", "accounts_by"] as const;
    const fields: Record<string, string | null> = {};
    for (const key of allowed) {
      if (key in body) {
        const val = body[key];
        fields[key] = typeof val === "string" ? val.trim() || null : null;
      }
    }
    if (Object.keys(fields).length === 0) {
      throw new AppError("No valid fields to update", 400);
    }

    const updated = await inboundGrnsService.updateGrnStatus(grnId, fields, user.email);
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
