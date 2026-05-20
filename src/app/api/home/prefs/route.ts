import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError, AppError } from "@/server/errors";
import {
  getDashboardPrefs,
  setDashboardPrefs,
} from "@/server/services/homeDashboardPrefsService";

/**
 * @swagger
 * /home/prefs:
 *   get:
 *     summary: Get dashboard preferences for current user
 *     tags: [Home]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *   put:
 *     summary: Update dashboard preferences for current user
 *     tags: [Home]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [layout]
 *             properties:
 *               layout: { type: object }
 *     responses:
 *       200: { description: OK }
 *       400: { description: layout is required }
 *       401: { description: Unauthorized }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const layout = await getDashboardPrefs(user.id);
    return NextResponse.json({ layout });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = (await request.json().catch(() => ({}))) as {
      layout?: unknown;
    };
    if (typeof body.layout !== "object" || body.layout == null) {
      throw new AppError("layout is required", 400);
    }
    const next = await setDashboardPrefs(user.id, body.layout);
    return NextResponse.json({ layout: next });
  } catch (err) {
    return handleApiError(err);
  }
}
