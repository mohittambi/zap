import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getBinChanges } from "@/server/services/binsService";

/**
 * @swagger
 * /bins/changes:
 *   get:
 *     summary: Paginated bin change history
 *     description: Requires purchase_orders:read.
 *     tags: [Bins]
 *     parameters:
 *       - { in: query, name: sku_id, schema: { type: string } }
 *       - { in: query, name: bin_id, schema: { type: string } }
 *       - { in: query, name: movement_type, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string } }
 *       - { in: query, name: to, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const result = await getBinChanges({
      sku_id: searchParams.get("sku_id") ?? undefined,
      bin_id: searchParams.get("bin_id") ?? undefined,
      movement_type: searchParams.get("movement_type") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
