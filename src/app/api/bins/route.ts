import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as binsService from "@/server/services/binsService";
import { parsePagination } from "@/server/validators/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "bins", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 500,
    });
    const filters = {
      warehouse_id: q.warehouse_id,
      sku_id: q.sku_id,
    };
    const data = await binsService.getBins(filters, page, limit);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
