import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getInsightSnapshot } from "@/server/services/insightSnapshotService";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "insights", "read");
    const { id } = await context.params;
    const snapshotId = Number(id);
    if (!Number.isFinite(snapshotId)) throw new AppError("Invalid snapshot id", 400);
    const row = await getInsightSnapshot(snapshotId);
    if (!row) throw new AppError("Snapshot not found", 404);
    return NextResponse.json(row);
  } catch (err) {
    return handleApiError(err);
  }
}
