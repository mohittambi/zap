import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const data = await listingsService.getSkuNames();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
