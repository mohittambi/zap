import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { id } = await context.params;
    const formId = Number.parseInt(id, 10);
    const u = new URL(request.url);
    const submittedBy = u.searchParams.get("submitted_by")?.trim();
    if (!formId || formId < 1) {
      throw new AppError("invalid id provided.", 400);
    }
    if (!submittedBy) {
      throw new AppError("submitted_by query parameter required", 400);
    }
    const data = await formsService.getFormResponse(formId, submittedBy);
    if (data === null) {
      throw new AppError("No response found", 404);
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
