import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listInsightSnapshots } from "@/server/services/insightSnapshotService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("count") ?? 20)));
    const data = await listInsightSnapshots({ page, limit });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
