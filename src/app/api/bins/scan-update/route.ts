import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as binsService from "@/server/services/binsService";
import type { MovementType } from "@/server/services/reorderService";

const VALID_MOVEMENT_TYPES = new Set<MovementType>([
  "SALE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT",
]);

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "write");

    const body = (await request.json()) as Record<string, unknown>;

    if (typeof body.bin_id !== "string" || !body.bin_id.trim()) {
      throw new AppError("bin_id is required", 400);
    }
    if (typeof body.sku_id !== "string" || !body.sku_id.trim()) {
      throw new AppError("sku_id is required", 400);
    }
    if (body.operation !== "ADD" && body.operation !== "REMOVE") {
      throw new AppError("operation must be 'ADD' or 'REMOVE'", 400);
    }
    const qty = Number(body.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new AppError("quantity must be a positive integer", 400);
    }

    const movementType = VALID_MOVEMENT_TYPES.has(body.movement_type as MovementType)
      ? (body.movement_type as MovementType)
      : undefined;

    const result = await binsService.adjustBinInventory({
      bin_id: body.bin_id,
      sku_id: body.sku_id,
      operation: body.operation,
      quantity: qty,
      user_id: String(user.id),
      movement_type: movementType,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
