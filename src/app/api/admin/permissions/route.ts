import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { PERMISSION_CATALOG } from "@/lib/permission-catalog";

/**
 * @swagger
 * /admin/permissions:
 *   get:
 *     summary: List assignable permissions with module metadata
 *     description: Requires admin (*:*).
 *     tags: [Admin]
 *     responses:
 *       200: { description: OK }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");
    return NextResponse.json(PERMISSION_CATALOG);
  } catch (err) {
    return handleApiError(err);
  }
}
