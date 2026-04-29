import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";

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
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
