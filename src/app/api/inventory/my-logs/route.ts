/**
 * @swagger
 * /inventory/my-logs:
 *   get:
 *     summary: Current user's inventory activity log
 *     description: |
 *       Merged feed of the authenticated user's inventory actions:
 *       - secondary-listing edits (from secondary_listings_logs.created_by = user.email)
 *       - bin quantity ADD/REMOVE movements (from warehouse_inventory_dump.user_id = user.id)
 *       Ordered by created_at DESC. Requires secondary_listings:read.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0, minimum: 0 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search across sku_id, bin_id and field_name (case-insensitive).
 *       - in: query
 *         name: movement_type
 *         schema: { type: string }
 *         description: When set, only bin-change rows of this movement type are returned (secondary-listings rows are excluded).
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source: { type: string, enum: [secondary_listings, bin_change] }
 *                       id: { type: integer }
 *                       action: { type: string }
 *                       sku_id: { type: string, nullable: true }
 *                       bin_id: { type: string, nullable: true }
 *                       quantity: { type: number, nullable: true }
 *                       movement_type: { type: string, nullable: true }
 *                       field_name: { type: string, nullable: true }
 *                       created_by: { type: string, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *                       details: { type: object, nullable: true }
 *       401: { description: Unauthorized }
 *       403: { description: Missing secondary_listings:read }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { getMyInventoryLogs } from "@/server/services/myInventoryLogService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "read");

    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
    const q = url.searchParams.get("q") ?? undefined;
    const movement_type = url.searchParams.get("movement_type") ?? undefined;

    const { total, logs } = await getMyInventoryLogs({
      user_id: user.id,
      user_email: user.email,
      limit,
      offset,
      q,
      movement_type,
    });
    return NextResponse.json({ total, limit, offset, logs });
  } catch (err) {
    return handleApiError(err);
  }
}
