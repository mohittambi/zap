import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

/**
 * @swagger
 * /vendors/listings/{vendor_id}:
 *   get:
 *     summary: Listings associated with a vendor
 *     description: Requires vendors:read.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: vendor_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid vendor id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ vendor_id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "read");
    const { vendor_id } = await context.params;
    const vendorId = Number.parseInt(vendor_id, 10);
    if (!vendorId) {
      throw new AppError("Invalid vendor id", 400);
    }
    const data = await vendorsService.getVendorListings(vendorId);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
