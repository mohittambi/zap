import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getRankedInsights } from "@/server/services/decisionIntelligenceService";

/**
 * @swagger
 * /insights:
 *   get:
 *     summary: Ranked decision intelligence worklist
 *     description: Requires insights:read (admin wildcard).
 *     tags: [Insights]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("count") ?? 50)));
    const domain = url.searchParams.get("domain") ?? undefined;
    const severity = url.searchParams.get("severity") ?? undefined;
    const search = url.searchParams.get("search_keyword") ?? undefined;

    const result = await getRankedInsights({
      page,
      limit,
      domain,
      severity,
      search,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
