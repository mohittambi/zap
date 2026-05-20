import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listOutboundCompaniesPaginated } from "@/server/services/outboundPurchaseOrdersService";

/**
 * @swagger
 * /outbound/companies:
 *   get:
 *     summary: All companies (paginated, with PO summary)
 *     description: Powers the mobile "All Companies" screen. Returns per-company PO counts (ack_pending / open_pos / expired_pos / cancelled_pos / last_po_at) plus a top-level summary across all companies. Requires purchase_orders:read.
 *     tags: [Outbound]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: search, schema: { type: string }, description: Optional company-name filter }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 current_page: { type: integer }
 *                 per_page_count: { type: integer }
 *                 curr_page_count: { type: integer }
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string, nullable: true }
 *                       logo_url: { type: string, nullable: true }
 *                       status: { type: string, nullable: true }
 *                       ack_pending: { type: integer }
 *                       open_pos: { type: integer }
 *                       expired_pos: { type: integer }
 *                       cancelled_pos: { type: integer }
 *                       last_po_at: { type: string, nullable: true, format: date-time }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     company_count: { type: integer }
 *                     ack_pending: { type: integer }
 *                     open_pos: { type: integer }
 *                     expired_pos: { type: integer }
 *                     cancelled_pos: { type: integer }
 *                     last_po_at: { type: string, nullable: true, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Missing purchase_orders:read }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const search = typeof q.search === "string" ? q.search : undefined;

    const data = await listOutboundCompaniesPaginated({
      page,
      limit,
      search,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
