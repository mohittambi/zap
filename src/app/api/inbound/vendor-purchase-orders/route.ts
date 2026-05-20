import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorPoService from "@/server/services/vendorPurchaseOrdersService";

/**
 * @swagger
 * /inbound/vendor-purchase-orders:
 *   get:
 *     summary: List vendor POs (paginated)
 *     description: Requires purchase_orders:read.
 *     tags: [Inbound]
 *     parameters:
 *       - in: query
 *         name: vendor_id
 *         required: true
 *         schema: { type: integer }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: count, schema: { type: integer, default: 100 } }
 *     responses:
 *       200: { description: OK }
 *       400: { description: vendor_id required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a vendor PO
 *     description: Requires purchase_orders:create.
 *     tags: [Inbound]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const vendorId = u.searchParams.get("vendor_id");
    if (!vendorId) {
      return NextResponse.json(
        { error: "vendor_id query parameter is required" },
        { status: 400 }
      );
    }
    const search_keyword = u.searchParams.get("search_keyword") ?? "";
    const page = u.searchParams.get("page") ?? "1";
    const count = u.searchParams.get("count") ?? "100";

    const data = await vendorPoService.listVendorPurchaseOrdersWithFilters({
      vendorId,
      searchKeyword: search_keyword,
      page,
      count,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "create");
    const body = (await request.json()) as Record<string, unknown>;
    const created = await vendorPoService.createVendorPurchaseOrder(
      body,
      user.email
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
