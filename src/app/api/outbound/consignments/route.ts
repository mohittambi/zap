import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOutboundConsignments } from "@/server/services/outboundConsignmentsService";

/**
 * @swagger
 * /outbound/consignments:
 *   get:
 *     summary: List outbound consignments (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 200 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: dir, schema: { type: string, enum: [asc, desc] } }
 *       - { in: query, name: pending_invoice, schema: { type: string } }
 *       - { in: query, name: invoice_pending, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;
    const sortBy = typeof q.sort === "string" ? q.sort : undefined;
    const sortDir = q.dir === "asc" ? "asc" : "desc";
    const invoicePending =
      q.pending_invoice === "1" ||
      q.pending_invoice === "true" ||
      q.invoice_pending === "1";

    const data = await listOutboundConsignments({
      page,
      limit,
      search,
      sortBy,
      sortDir,
      invoicePending,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
