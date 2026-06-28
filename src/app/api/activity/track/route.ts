import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import { inferResourceFromPath } from "@/lib/requestMeta";

const lastNavByUser = new Map<number, { path: string; at: number }>();

function shouldSkipDuplicateNavigation(userId: number, path: string): boolean {
  const now = Date.now();
  const prev = lastNavByUser.get(userId);
  if (prev && prev.path === path && now - prev.at < 1000) {
    return true;
  }
  lastNavByUser.set(userId, { path, at: now });
  return false;
}

/**
 * @swagger
 * /activity/track:
 *   post:
 *     summary: Record client navigation (and optional session events)
 *     description: Authenticated users only. Rate-limited to one navigation per path per second.
 *     tags: [Activity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, default: navigation }
 *               path: { type: string }
 *               session_id: { type: string, format: uuid }
 *               details: { type: object }
 *     responses:
 *       204: { description: Recorded }
 *       401: { description: Unauthorized }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      path?: string;
      session_id?: string;
      details?: Record<string, unknown>;
    };

    const action = (body.action ?? "navigation").trim().slice(0, 100);
    const path =
      typeof body.path === "string" && body.path.trim()
        ? body.path.trim().slice(0, 500)
        : new URL(request.url).pathname;

    if (action === "navigation" && shouldSkipDuplicateNavigation(user.id, path)) {
      return new NextResponse(null, { status: 204 });
    }

    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      sessionId: body.session_id ?? null,
      action,
      resource: inferResourceFromPath(path),
      path,
      method: "NAV",
      statusCode: 204,
      details: body.details ?? {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
