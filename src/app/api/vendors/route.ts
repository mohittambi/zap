import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as vendorsService from "@/server/services/vendorsService";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "vendors", "create");
    const body = (await request.json()) as Record<string, unknown>;
    const created = await vendorsService.createVendor(body, user.email);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
