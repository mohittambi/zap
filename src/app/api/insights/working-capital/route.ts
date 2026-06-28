import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getWorkingCapitalAnalysis } from "@/server/services/insightWorkingCapitalService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
    const data = await getWorkingCapitalAnalysis(limit);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
