import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as cataloguesService from "@/server/services/cataloguesService";
import { parsePagination } from "@/server/validators/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 28,
      maxLimit: 200,
    });
    const data = await cataloguesService.listCatalogues({
      catalogue_type: q.catalogue_type,
      search_keyword: (q.search_keyword || "").trim(),
      page,
      limit,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "catalogues", "write");
    const body = await request.json();
    const data = await cataloguesService.createCatalogue({
      catalogue_type: body.catalogue_type === "custom" ? "custom" : "standard",
      name: body.name,
      description: body.description,
      created_by: user.email,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
