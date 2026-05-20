import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOutboundConsignmentItemsPaginated } from "@/server/services/outboundConsignmentItemsService";

type Ctx = { params: Promise<{ id: string }> };

/**
 * @swagger
 * /outbound/consignments/{id}/items:
 *   get:
 *     summary: Paginated consignment line items
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid consignment id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request, context: Ctx) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid consignment id" }, { status: 400 });
    }

    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;

    const payload = await listOutboundConsignmentItemsPaginated({
      consignmentId: id,
      page,
      limit,
      search,
    });

    return NextResponse.json(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
