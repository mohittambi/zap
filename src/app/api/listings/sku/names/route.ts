import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";

/**
 * @swagger
 * /listings/sku/names:
 *   get:
 *     summary: List SKU names (for autocomplete)
 *     description: Requires listings:read.
 *     tags: [Listings]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const data = await listingsService.getSkuNames();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
