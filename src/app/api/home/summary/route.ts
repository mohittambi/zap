import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getHomeSummary } from "@/server/services/homeSummaryService";
import { isIsoDay } from "@/lib/dashboard-date-range";

/**
 * @swagger
 * /home/summary:
 *   get:
 *     summary: Home dashboard KPI summary
 *     description: Requires bins:read.
 *     tags: [Home]
 *     parameters:
 *       - { in: query, name: company_id, schema: { type: integer } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid company_id or date range }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
// GET /api/home/summary?company_id=&from=&to= — KPI cards, trends, reorder strip.
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
    const fromRaw = u.searchParams.get("from");
    const toRaw = u.searchParams.get("to");
    const from = fromRaw != null && fromRaw !== "" ? fromRaw : undefined;
    const to = toRaw != null && toRaw !== "" ? toRaw : undefined;
    if (from != null && !isIsoDay(from)) {
      return NextResponse.json({ error: "Invalid from — use YYYY-MM-DD" }, { status: 400 });
    }
    if (to != null && !isIsoDay(to)) {
      return NextResponse.json({ error: "Invalid to — use YYYY-MM-DD" }, { status: 400 });
    }
    const data = await getHomeSummary({ companyId, from, to });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
