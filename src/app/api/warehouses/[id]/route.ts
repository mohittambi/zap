import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as warehousesService from "@/server/services/warehousesService";

/**
 * @swagger
 * /warehouses/{id}:
 *   get:
 *     summary: Get warehouse by id
 *     description: Requires warehouses:read.
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid warehouse id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Warehouse not found }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "warehouses", "read");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) {
      throw new AppError("Invalid warehouse id", 400);
    }
    const data = await warehousesService.getWarehouseById(numId);
    if (!data) {
      throw new AppError("Warehouse not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
