import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inboundGrnsService from "@/server/services/inboundGrnsService";

/**
 * @swagger
 * /inbound/pending-invoice-collection/grns:
 *   get:
 *     summary: GRNs pending invoice collection (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - { in: query, name: vendor_id, schema: { type: integer } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: count, schema: { type: integer, default: 100 } }
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
    const vendor_id = q.vendor_id;
    const search_keyword = q.search_keyword ?? "";
    const page = q.page ?? "1";
    const count = q.count ?? "100";

    const data = await inboundGrnsService.listPendingInvoiceCollectionGrnsPaginated({
      vendorId: vendor_id,
      searchKeyword: search_keyword,
      page,
      count,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
