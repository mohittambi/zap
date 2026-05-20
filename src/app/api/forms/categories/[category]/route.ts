import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

/**
 * @swagger
 * /forms/categories/{category}:
 *   get:
 *     summary: List sub-categories for a form category
 *     description: Requires forms:read.
 *     tags: [Forms]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ category: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { category } = await context.params;
    const data = await formsService.getFormSubCategories(category);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
