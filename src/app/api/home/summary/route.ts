import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getHomeSummary } from "@/server/services/homeSummaryService";

/**
 * @swagger
 * /home/summary:
 *   get:
 *     summary: Home dashboard KPI summary
 *     description: Requires bins:read.
 *     tags: [Home]
 *     parameters:
 *       - { in: query, name: company_id, schema: { type: integer } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid company_id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
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
