import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { AppError, handleApiError } from "@/server/errors";
import * as formsService from "@/server/services/formsService";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "forms", "read");
    const { id, userId } = await context.params;
    const formId = Number.parseInt(id, 10);
    if (!formId || formId < 1) {
      throw new AppError("invalid id provided.", 400);
    }
    const data = await formsService.getTodaySubmission(formId, userId);
    return NextResponse.json(data ?? null);
  } catch (err) {
    return handleApiError(err);
  }
}
