import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

/**
 * @swagger
 * /forms/categories:
 *   get:
 *     summary: List form categories
 *     description: Requires forms:read.
 *     tags: [Forms]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const data = await formsService.getFormCategories();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
