import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import {
  buildActivityContext,
  logActivity,
} from "@/server/services/activityLogService";
import * as listingsService from "@/server/services/listingsService";

/**
 * @swagger
 * /listings/sku/{sku_id}:
 *   get:
 *     summary: Get listing by SKU
 *     description: Requires listings:read.
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: SKU not found }
 *   patch:
 *     summary: Update listing fields (ops_tag/category/sku_type/bulk_price/no_of_constituents)
 *     description: Requires listings:write.
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: sku_id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ops_tag: { type: string, nullable: true }
 *               category: { type: string, nullable: true }
 *               sku_type: { type: string, nullable: true }
 *               bulk_price: { type: number, nullable: true }
 *               no_of_constituents: { type: integer, nullable: true }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: SKU not found }
 *   delete:
 *     summary: Soft-delete a master listing (admin only)
 *     tags: [Listings]
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden }
 *       404: { description: SKU not found }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const { sku_id } = await context.params;
    const data = await listingsService.getListingBySku(sku_id);
    if (!data) {
      throw new AppError("SKU not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "write");
    const { sku_id } = await context.params;

    const body = (await request.json()) as Record<string, unknown>;

    type UpdateFields = {
      ops_tag?: string | null;
      category?: string | null;
      sku_type?: string | null;
      bulk_price?: number | null;
      no_of_constituents?: number | null;
    };
    const fields: UpdateFields = {};

    if ("ops_tag" in body) {
      const val = body.ops_tag;
      fields.ops_tag = typeof val === "string" ? val.trim() || null : null;
    }
    if ("category" in body) {
      const val = body.category;
      fields.category = typeof val === "string" ? val.trim() || null : null;
    }
    if ("sku_type" in body) {
      const val = body.sku_type;
      fields.sku_type = typeof val === "string" ? val.trim() || null : null;
    }
    if ("bulk_price" in body) {
      const val = body.bulk_price;
      if (val === null || val === undefined) {
        fields.bulk_price = null;
      } else {
        const n = Number(val);
        if (Number.isNaN(n) || n < 0) {
          throw new AppError("bulk_price must be a non-negative number", 400);
        }
        fields.bulk_price = n;
      }
    }
    if ("no_of_constituents" in body) {
      const val = body.no_of_constituents;
      if (val === null || val === undefined) {
        fields.no_of_constituents = null;
      } else {
        const n = Number(val);
        if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
          throw new AppError("no_of_constituents must be a non-negative integer", 400);
        }
        fields.no_of_constituents = n;
      }
    }

    if (Object.keys(fields).length === 0) {
      throw new AppError("No valid fields to update", 400);
    }

    const updated = await listingsService.updateListingBySku(sku_id, fields);
    if (!updated) {
      throw new AppError("SKU not found", 404);
    }

    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "listing_updated",
      resource: "listings",
      resourceId: sku_id,
      statusCode: 200,
      details: { fields },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sku_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "delete");
    const { sku_id } = await context.params;

    const deletedSku = await listingsService.softDeleteListing(sku_id, user.email);

    const ctx = buildActivityContext(request, user.id);
    await logActivity({
      ...ctx,
      action: "listing_deleted",
      resource: "listings",
      resourceId: deletedSku,
      statusCode: 200,
      details: { sku_id: deletedSku, soft_delete: true },
    });

    return NextResponse.json({ ok: true, sku_id: deletedSku });
  } catch (err) {
    return handleApiError(err);
  }
}
