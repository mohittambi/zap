import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as binsService from "@/server/services/binsService";

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
