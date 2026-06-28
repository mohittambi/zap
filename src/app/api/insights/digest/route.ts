import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getRankedInsights } from "@/server/services/decisionIntelligenceService";
import { getInsightConfig } from "@/server/services/insightConfigService";
import { saveInsightSnapshot } from "@/server/services/insightSnapshotService";
import { insightsDigestScheduler } from "@/config/schedulers";

function isDigestCronRequest(request: Request): boolean {
  const token = insightsDigestScheduler.bearerToken;
  if (!token) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  try {
    if (!isDigestCronRequest(request)) {
      const user = await requireAuth(request);
      assertSuperAdmin(user);
    }

    const config = await getInsightConfig();
    if (!config.digest_enabled && isDigestCronRequest(request)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "digest_disabled" });
    }

    const worklist = await getRankedInsights({ limit: 500 });
    const trigger = isDigestCronRequest(request) ? "SCHEDULED" : "MANUAL";
    const saved = await saveInsightSnapshot({
      trigger,
      insights: worklist.content,
    });

    return NextResponse.json({
      ok: true,
      snapshot_id: saved.snapshot_id,
      summary: saved.summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
