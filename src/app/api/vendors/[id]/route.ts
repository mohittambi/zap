import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "read");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) throw new AppError("Invalid vendor id", 400);
    const data = await vendorsService.getVendorById(numId);
    if (!data) throw new AppError("Vendor not found", 404);
    return NextResponse.json(data);
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
    assertPermission(user, "vendors", "write");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) throw new AppError("Invalid vendor id", 400);
    const body = (await request.json()) as Record<string, unknown>;
    const updated = await vendorsService.updateVendor(numId, body, user.email);
    return NextResponse.json(updated);
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
    assertPermission(user, "vendors", "delete");
    const { id } = await context.params;
    const numId = Number.parseInt(id, 10);
    if (!numId) throw new AppError("Invalid vendor id", 400);
    const result = await vendorsService.deleteVendor(numId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
