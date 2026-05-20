import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

/**
 * @swagger
 * /forms/categories/{category}/{sub_category}:
 *   get:
 *     summary: Get form by category + sub_category
 *     description: Requires forms:read.
 *     tags: [Forms]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: sub_category
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Form not found }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ category: string; sub_category: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { category, sub_category } = await context.params;
    const data = await formsService.getFormByCategoryAndSubCategory(
      category,
      sub_category
    );
    if (!data) {
      throw new AppError("Form not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
