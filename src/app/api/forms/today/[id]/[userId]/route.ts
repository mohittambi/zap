import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

/**
 * @swagger
 * /forms/today/{id}/{userId}:
 *   get:
 *     summary: Get today's form submission for a user
 *     description: Requires forms:read.
 *     tags: [Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { id, userId } = await context.params;
    const isAdmin =
      user.roles.includes("admin") ||
      user.permissions.some((p) => p.resource === "*" && p.action === "*");
    if (
      userId !== String(user.id) &&
      userId !== user.email &&
      !isAdmin
    ) {
      throw new AppError("Forbidden", 403);
    }
    const formId = Number.parseInt(id, 10);
    if (!formId || formId < 1) {
      throw new AppError("invalid id provided.", 400);
    }
    const data = await formsService.getTodaySubmission(formId, userId);
    return NextResponse.json(data ?? null);
  } catch (err) {
    return handleApiError(err);
  }
}
