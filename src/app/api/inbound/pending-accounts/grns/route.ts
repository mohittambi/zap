/**
 * GET /api/inbound/pending-accounts/grns
 * Paginated list of GRNs in the accounts approval queue.
 * Requires purchase_orders:read.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listPendingAccountsGrnsPaginated } from "@/server/services/grnAccountsService";

/**
 * @swagger
 * /inbound/pending-accounts/grns:
 *   get:
 *     summary: GRNs pending accounts approval (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: count, schema: { type: integer } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: vendor_id, schema: { type: integer } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const url = new URL(request.url);
    const result = await listPendingAccountsGrnsPaginated({
      page: url.searchParams.get("page"),
      count: url.searchParams.get("count"),
      searchKeyword: url.searchParams.get("search_keyword"),
      vendorId: url.searchParams.get("vendor_id"),
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
