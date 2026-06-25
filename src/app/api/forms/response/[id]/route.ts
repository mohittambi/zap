import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

/**
 * @swagger
 * /forms/response/{id}:
 *   get:
 *     summary: Get a form response by id + submitter
 *     description: Requires forms:read.
 *     tags: [Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: submitted_by
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: No response found }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { id } = await context.params;
    const formId = Number.parseInt(id, 10);
    const u = new URL(request.url);
    const submittedBy = u.searchParams.get("submitted_by")?.trim();
    if (!formId || formId < 1) {
      throw new AppError("invalid id provided.", 400);
    }
    if (!submittedBy) {
      throw new AppError("submitted_by query parameter required", 400);
    }
    const isAdmin = user.permissions.some(
      (p) => p.resource === "*" && p.action === "*"
    );
    if (
      submittedBy !== String(user.id) &&
      submittedBy !== user.email &&
      !isAdmin
    ) {
      throw new AppError("Forbidden", 403);
    }
    const data = await formsService.getFormResponse(formId, submittedBy);
    if (data === null) {
      throw new AppError("No response found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
