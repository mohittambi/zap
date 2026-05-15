import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getReorderMetrics } from "@/server/services/reorderService";
import { parsePagination } from "@/server/validators/pagination";

// GET /api/reorder/metrics — all SKU reorder metrics, optional keyword filter
// ?alerts_only=true  — restrict to SKUs in alert state
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, { page: 1, limit: 50, maxLimit: 200 });
    const data = await getReorderMetrics({
      keyword: q.keyword,
      alertsOnly: q.alerts_only === "true",
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
