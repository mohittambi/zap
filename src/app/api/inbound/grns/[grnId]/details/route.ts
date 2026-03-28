import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  getGrnDetailsBundle,
  ingestGrnDetailsByGrnId,
  snapshotExists,
} from "@/server/services/eautomateGrnDetailsIngestService";

type RouteContext = { params: Promise<{ grnId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { grnId } = await context.params;
    const id = Number(grnId);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid grn id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "1";
    const hasSnapshot = await snapshotExists(id);
    if (refresh || !hasSnapshot) {
      await ingestGrnDetailsByGrnId(id);
    }

    const bundle = await getGrnDetailsBundle(id);
    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}
