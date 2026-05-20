import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

/**
 * @swagger
 * /vendors/all:
 *   get:
 *     summary: All vendors (flat list)
 *     description: Requires vendors:read.
 *     tags: [Vendors]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "read");
    const data = await vendorsService.getAllVendors();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
