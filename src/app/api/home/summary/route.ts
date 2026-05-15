import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getHomeSummary } from "@/server/services/homeSummaryService";

// GET /api/home/summary?company_id= — KPI cards, 90-day trends, reorder strip.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const raw = u.searchParams.get("company_id");
    const companyId = raw != null && raw !== "" ? Number(raw) : null;
    if (companyId != null && !Number.isFinite(companyId)) {
      return NextResponse.json({ error: "Invalid company_id" }, { status: 400 });
    }
    const data = await getHomeSummary({ companyId });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
