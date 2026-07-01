import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  listDistinctActivityActions,
  listDistinctActivityResources,
  queryActivityLog,
} from "@/server/services/activityLogService";

/**
 * @swagger
 * /admin/activity-log:
 *   get:
 *     summary: Query activity log (admin only)
 *     tags: [Admin]
 *     parameters:
 *       - { in: query, name: email, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: resource, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 100 } }
 *       - { in: query, name: meta, schema: { type: string, enum: [actions, resources] } }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertAdmin(user);

    const u = new URL(request.url);
    const meta = u.searchParams.get("meta");

    if (meta === "actions") {
      const actions = await listDistinctActivityActions();
      return NextResponse.json({ actions });
    }
    if (meta === "resources") {
      const resources = await listDistinctActivityResources();
      return NextResponse.json({ resources });
    }

    const email = u.searchParams.get("email")?.trim().toLowerCase() || undefined;

    const data = await queryActivityLog({
      userEmail: email,
      action: u.searchParams.get("action") ?? undefined,
      resource: u.searchParams.get("resource") ?? undefined,
      from: u.searchParams.get("from") ?? undefined,
      to: u.searchParams.get("to") ?? undefined,
      page: Number(u.searchParams.get("page") ?? 1),
      limit: Number(u.searchParams.get("limit") ?? 50),
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
