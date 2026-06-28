import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertAdmin } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import * as listingsService from "@/server/services/listingsService";

/**
 * @swagger
 * /listings:
 *   post:
 *     summary: Create a new master listing
 *     description: Requires admin (*:*). Allocates a stub ID and marks source=zap.
 *     tags: [Listings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sku_id, description]
 *             properties:
 *               sku_id: { type: string }
 *               description: { type: string }
 *               category: { type: string, nullable: true }
 *               sku_type: { type: string, enum: [SINGLE, PACK, COMBO] }
 *               ops_tag: { type: string, nullable: true }
 *               inventory_bypass_on: { type: string, enum: [YES, NO] }
 *               bulk_price: { type: number, nullable: true }
 *               actual_weight: { type: number, nullable: true }
 *               dimension: { type: string, nullable: true }
 *               no_of_constituents: { type: integer }
 *               material_info: { type: string, nullable: true }
 *               keyword_pool: { type: string, nullable: true }
 *               img_hd: { type: string, nullable: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: SKU already exists }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertAdmin(user);

    const body = (await request.json()) as Record<string, unknown>;
    const listing = await listingsService.createListing(body, user.email);
    if (!listing) {
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 }
      );
    }

    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "listing_created",
      resource: "listings",
      resourceId: listing.sku_id,
      statusCode: 201,
      details: { sku_id: listing.sku_id },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
