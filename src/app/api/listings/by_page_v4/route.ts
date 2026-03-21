import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";
import { parsePagination } from "@/server/validators/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "listings", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const search_keyword = (q.search_keyword || "").trim();
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 200,
    });
    const data = await listingsService.getListingsByPage(
      search_keyword,
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
