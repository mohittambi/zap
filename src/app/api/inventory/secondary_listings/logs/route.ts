/**
 * @swagger
 * /inventory/secondary_listings/logs:
 *   get:
 *     summary: Secondary listing change-history logs
 *     description: Returns the last 50 change-history entries for a secondary SKU. Requires secondary_listings:read.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: secondary_sku
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs: { type: array, items: { type: object } }
 *       400: { description: secondary_sku is required }
 *       401: { description: Unauthorized }
 *       403: { description: Missing secondary_listings:read }
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import { getLogsForSku } from "@/server/services/secondaryListingsLogsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "read");

    const url = new URL(request.url);
    const secondary_sku = url.searchParams.get("secondary_sku")?.trim() ?? "";
    if (!secondary_sku) {
      throw new AppError("secondary_sku is required", 400);
    }

    const logs = await getLogsForSku(secondary_sku);
    return NextResponse.json({ logs });
  } catch (err) {
    return handleApiError(err);
  }
}
