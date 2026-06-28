import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getInsightsSummary } from "@/server/services/decisionIntelligenceService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "insights", "read");
    const summary = await getInsightsSummary();
    return NextResponse.json(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
