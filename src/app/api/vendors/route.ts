import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create a vendor
 *     description: Requires vendors:create.
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Created }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "create");
    const body = (await request.json()) as Record<string, unknown>;
    const created = await vendorsService.createVendor(body, user.email);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
