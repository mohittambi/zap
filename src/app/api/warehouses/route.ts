import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as warehousesService from "@/server/services/warehousesService";

/**
 * @swagger
 * /warehouses:
 *   get:
 *     summary: List all warehouses
 *     description: Requires warehouses:read.
 *     tags: [Warehouses]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "warehouses", "read");
    const data = await warehousesService.getAllWarehouses();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
