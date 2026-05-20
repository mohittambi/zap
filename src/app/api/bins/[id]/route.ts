import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as binsService from "@/server/services/binsService";

/**
 * @swagger
 * /bins/{id}:
 *   get:
 *     summary: Get bin by id
 *     description: Requires bins:read.
 *     tags: [Bins]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid bin id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Bin not found }
 *   patch:
 *     summary: Update bin SKU/quantity
 *     description: Requires bins:write.
 *     tags: [Bins]
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
 *             required: [sku_id, available_quantity]
 *             properties:
 *               sku_id: { type: string }
 *               available_quantity: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Bin not found }
 *   delete:
 *     summary: Delete bin
 *     description: Requires bins:manage.
 *     tags: [Bins]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Invalid bin id }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) {
      throw new AppError("Invalid bin id", 400);
    }
    const data = await binsService.getBinById(numId);
    if (!data) {
      throw new AppError("Bin not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "manage");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) {
      throw new AppError("Invalid bin id", 400);
    }
    await binsService.deleteBin(numId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "write");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) {
      throw new AppError("Invalid bin id", 400);
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (!("sku_id" in body) || typeof body.sku_id !== "string") {
      throw new AppError("sku_id is required", 400);
    }
    if (!("available_quantity" in body)) {
      throw new AppError("available_quantity is required", 400);
    }

    const qty = Number(body.available_quantity);
    if (Number.isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new AppError("available_quantity must be a non-negative integer", 400);
    }

    const updated = await binsService.updateBinQuantity(numId, body.sku_id, qty);
    if (!updated) {
      throw new AppError("Bin not found or does not belong to this SKU", 404);
    }
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
