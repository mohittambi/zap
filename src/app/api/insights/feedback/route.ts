import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertSuperAdmin } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { addInsightFeedback } from "@/server/services/insightFeedbackService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import type { InsightFeedbackAction } from "@/lib/insightTypes";

const ACTIONS = new Set<InsightFeedbackAction>(["DISMISSED", "SNOOZED", "ACTED"]);

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertSuperAdmin(user);
    const body = (await request.json()) as Record<string, unknown>;
    const insight_key =
      typeof body.insight_key === "string" ? body.insight_key.trim() : "";
    const action = body.action;
    if (insight_key === "") throw new AppError("insight_key is required", 400);
    if (typeof action !== "string" || !ACTIONS.has(action as InsightFeedbackAction)) {
      throw new AppError("action must be DISMISSED, SNOOZED, or ACTED", 400);
    }
    const snooze_until =
      typeof body.snooze_until === "string" ? body.snooze_until.trim() : null;
    const note = typeof body.note === "string" ? body.note.trim() : null;

    await addInsightFeedback({
      insight_key,
      action: action as InsightFeedbackAction,
      snooze_until: action === "SNOOZED" ? snooze_until : null,
      note,
      created_by: user.email,
    });
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "insight_feedback",
      resource: "insights",
      resourceId: insight_key,
      statusCode: 200,
      details: { action, note },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
