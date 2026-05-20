import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorPoService from "@/server/services/vendorPurchaseOrdersService";

/**
 * @swagger
 * /inbound/purchase-orders:
 *   get:
 *     summary: List inbound purchase orders (paginated, filterable)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: count, schema: { type: integer, default: 100 } }
 *       - { in: query, name: po_id_filter, schema: { type: integer } }
 *       - { in: query, name: vendor_ids, schema: { type: string }, description: Comma-separated vendor ids }
 *       - { in: query, name: sort_by, schema: { type: string } }
 *       - { in: query, name: sort_dir, schema: { type: string, enum: [asc, desc] } }
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
    const search_keyword = q.search_keyword ?? "";
    const page = q.page ?? "1";
    const count = q.count ?? "100";

    const vendorIds = (q.vendor_ids ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);

    const sortBy = typeof q.sort_by === "string" ? q.sort_by.trim() || undefined : undefined;
    let sortDir: "asc" | "desc" | undefined;
    if (q.sort_dir === "asc") sortDir = "asc";
    else if (q.sort_dir === "desc") sortDir = "desc";

    const data = await vendorPoService.listAllPurchaseOrdersWithFilters({
      searchKeyword: search_keyword,
      page,
      count,
      filterPoId: q.po_id_filter,
      filterVendorIds: vendorIds.length ? vendorIds : undefined,
      sortBy,
      sortDir,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
