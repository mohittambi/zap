import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inventoryService from "@/server/services/inventoryService";
import { parsePagination } from "@/server/validators/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "inventory", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const search_keyword = (q.search_keyword || "").trim();
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 1000,
      maxLimit: 1000,
    });
    const data = await inventoryService.getSecondaryListingsPaginated(
      search_keyword,
      page,
      limit
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
