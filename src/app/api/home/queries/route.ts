import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { listSavedQueries } from "@/server/queries/homeSavedQueries";

// GET /api/home/queries — list available saved queries with their param specs.
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    return NextResponse.json({ queries: listSavedQueries() });
  } catch (err) {
    return handleApiError(err);
  }
}
