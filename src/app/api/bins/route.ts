import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as binsService from "@/server/services/binsService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /bins:
 *   get:
 *     summary: List bins (paginated, filterable)
 *     description: Requires bins:read.
 *     tags: [Bins]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 500 } }
 *       - { in: query, name: warehouse_id, schema: { type: string } }
 *       - { in: query, name: sku_id, schema: { type: string } }
 *       - { in: query, name: bin_id, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a bin
 *     description: Requires bins:manage.
 *     tags: [Bins]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouse_id, sku_id, bin_id]
 *             properties:
 *               warehouse_id: { type: integer }
 *               sku_id: { type: string }
 *               bin_id: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Bad request }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 500,
    });
    const filters = {
      warehouse_id: q.warehouse_id,
      sku_id: q.sku_id,
      bin_id: q.bin_id,
    };
    const data = await binsService.getBins(filters, page, limit);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "manage");

    const body = (await request.json()) as Record<string, unknown>;
    const warehouseId = Number(body.warehouse_id);
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
      throw new AppError("warehouse_id must be a positive integer", 400);
    }
    if (typeof body.sku_id !== "string" || !body.sku_id.trim()) {
      throw new AppError("sku_id is required", 400);
    }
    if (typeof body.bin_id !== "string" || !body.bin_id.trim()) {
      throw new AppError("bin_id is required", 400);
    }

    const bin = await binsService.createBin(warehouseId, body.sku_id, body.bin_id);
    return NextResponse.json(bin, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
