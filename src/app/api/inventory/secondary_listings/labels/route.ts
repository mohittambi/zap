import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inventoryService from "@/server/services/inventoryService";

/**
 * @swagger
 * /inventory/secondary_listings/labels:
 *   patch:
 *     summary: Update secondary listing label/spec fields
 *     description: Requires secondary_listings:manage.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               secondary_sku: { type: string }
 *               ean_code: { type: string }
 *               size: { type: string }
 *               color: { type: string }
 *               one_set_contains: { type: integer }
 *               mrp: { type: number }
 *               material: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "secondary_listings", "manage");
    const body = await request.json().catch(() => ({}));
    const secondary_sku =
      typeof body.secondary_sku === "string" ? body.secondary_sku.trim() : "";

    const data = await inventoryService.updateLabelsData(
      secondary_sku,
      {
        ean_code: body.ean_code,
        size: body.size,
        color: body.color,
        one_set_contains: body.one_set_contains,
        mrp: body.mrp,
        material: body.material,
      },
      user.email
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
