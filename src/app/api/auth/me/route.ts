import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handleApiError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json({
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
