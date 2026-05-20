import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Current authenticated user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: integer }
 *                 email: { type: string }
 *                 roles: { type: array, items: { type: string } }
 *                 permissions: { type: array, items: { type: string } }
 *       401: { description: Unauthorized }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json({
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
