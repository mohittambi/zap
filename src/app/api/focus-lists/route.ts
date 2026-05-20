import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as focusListsService from "@/server/services/focusListsService";

/**
 * @swagger
 * /focus-lists:
 *   get:
 *     summary: List focus lists
 *     description: Requires focus_lists:read.
 *     tags: [Focus Lists]
 *     parameters:
 *       - { in: query, name: is_public, schema: { type: string, enum: [true, false] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create focus list
 *     description: Requires focus_lists:write.
 *     tags: [Focus Lists]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               is_public: { type: boolean }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "focus_lists", "read");
    const u = new URL(request.url);
    const isPublic = u.searchParams.get("is_public");
    const filters =
      isPublic === "true"
        ? { is_public: true }
        : isPublic === "false"
          ? { is_public: false }
        : {};
    const data = await focusListsService.listFocusLists(filters);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "focus_lists", "write");
    const body = await request.json();
    const data = await focusListsService.createFocusList({
      title: body.title,
      description: body.description,
      is_public: Boolean(body.is_public),
      created_by: user.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
