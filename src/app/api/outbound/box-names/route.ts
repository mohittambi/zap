import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listOutboundValidBoxNames } from "@/server/services/outboundConsignmentItemsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const rows = await listOutboundValidBoxNames();
    return NextResponse.json({ content: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
