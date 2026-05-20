import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

/**
 * @swagger
 * /vendors/{id}/listings:
 *   post:
 *     summary: Add a vendor-listing association
 *     description: Requires vendors:write.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sku_id]
 *             properties:
 *               sku_id: { type: string }
 *               cost_price: { type: number, nullable: true }
 *     responses:
 *       200: { description: OK (duplicate) }
 *       201: { description: Created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "write");
    const { id } = await context.params;
    const body = (await request.json()) as {
      sku_id?: string;
      cost_price?: number | string | null;
    };
    const result = await vendorsService.addVendorListing(
      id,
      body.sku_id,
      body.cost_price,
      user.email
    );
    return NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
