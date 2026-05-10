import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getGrnDetailsBundle } from "@/server/services/eautomateGrnDetailsIngestService";

type RouteContext = { params: Promise<{ grnId: string }> };

/** zap DB only. Sync from eAutomate is run via `npm run sync:grn:details*`. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await context.params;
    const id = Number(grnId);
    if (!Number.isFinite(id) || id === 0) {
      return NextResponse.json({ message: "Invalid grn id" }, { status: 400 });
    }

    const bundle = await getGrnDetailsBundle(id);
    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}
