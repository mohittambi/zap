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
    if (!numId) {
      throw new AppError("Invalid vendor id", 400);
    }
    const data = await vendorsService.getVendorById(numId);
    if (!data) {
      throw new AppError("Vendor not found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
