import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log logout and end session tracking
 *     tags: [Auth]
 *     responses:
 *       204: { description: Logged }
 *       401: { description: Unauthorized }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string;
    };
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      sessionId: body.session_id ?? null,
      action: "logout",
      resource: "auth",
      statusCode: 204,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
