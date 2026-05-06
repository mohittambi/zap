/**
 * GET /api/auth/can?resource=X&action=Y
 * Returns { allowed: true } if the current user has the given permission, else { allowed: false }.
 * Used by client-side code to conditionally show edit UI without embedding permission logic in the browser.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "";
    const action = url.searchParams.get("action") ?? "";

    try {
      assertPermission(user, resource, action);
      return NextResponse.json({ allowed: true });
    } catch {
      return NextResponse.json({ allowed: false });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
