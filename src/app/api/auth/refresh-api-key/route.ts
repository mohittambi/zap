import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/server/db";
import { apiKeyPrefixFromToken, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import { logAdminAction } from "@/server/services/adminAuditService";

/**
 * @swagger
 * /auth/refresh-api-key:
 *   post:
 *     summary: Generate a new API key for the current admin user
 *     description: Admin (*:*) required. The new key is returned exactly once.
 *     tags: [Auth]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");

    const rawKey = `zap_${crypto.randomBytes(24).toString("hex")}`;
    const hash = await bcrypt.hash(rawKey, 10);
    const prefix = apiKeyPrefixFromToken(rawKey);

    await query(
      `UPDATE users SET api_key_hash = $1, api_key_prefix = $2, updated_at = NOW() WHERE id = $3`,
      [hash, prefix, user.id]
    );

    await logAdminAction(user.id, "api_key_regenerated", user.id);
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "api_key_regenerated",
      resource: "auth",
      resourceId: String(user.id),
      statusCode: 200,
    });

    return NextResponse.json({
      api_key: rawKey,
      message: "Store this key securely; it will not be shown again.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
