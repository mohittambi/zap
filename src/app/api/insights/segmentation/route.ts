import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getSkuSegmentation } from "@/server/services/insightSegmentationService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "insights", "read");
    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 200)));
    const data = await getSkuSegmentation(limit);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
