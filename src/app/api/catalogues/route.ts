import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as cataloguesService from "@/server/services/cataloguesService";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /catalogues:
 *   get:
 *     summary: List catalogues (paginated)
 *     description: Requires catalogues:read.
 *     tags: [Catalogues]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 28, maximum: 200 } }
 *       - { in: query, name: catalogue_type, schema: { type: string } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create catalogue
 *     description: Requires catalogues:write.
 *     tags: [Catalogues]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               catalogue_type: { type: string, enum: [standard, custom] }
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 28,
      maxLimit: 200,
    });
    const data = await cataloguesService.listCatalogues({
      catalogue_type: q.catalogue_type,
      search_keyword: (q.search_keyword || "").trim(),
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const body = await request.json();
    const data = await cataloguesService.createCatalogue({
      catalogue_type: body.catalogue_type === "custom" ? "custom" : "standard",
      name: body.name,
      description: body.description,
      created_by: user.email,
    });
    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "catalogue_created",
      resource: "catalogues",
      resourceId: String(data.id ?? ""),
      statusCode: 201,
      details: { name: body.name },
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
