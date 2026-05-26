import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import { listEanMappingsMatrixPaginated } from "@/server/services/eanMappingsService";

/**
 * @swagger
 * /ean-mappings/matrix:
 *   get:
 *     summary: Paginated SKU × company EAN matrix (wide / Excel-style)
 *     tags: [Outbound]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "purchase_orders", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 100,
    });
    const companyId =
      q.company_id != null && q.company_id !== ""
        ? Number(q.company_id)
        : undefined;
    const search = typeof q.search === "string" ? q.search : undefined;
    const sort = typeof q.sort === "string" ? q.sort : undefined;
    const sortDir =
      q.sort_dir === "desc" ? ("desc" as const) : ("asc" as const);

    const data = await listEanMappingsMatrixPaginated({
      page,
      limit,
      companyId:
        companyId != null && Number.isFinite(companyId) && companyId > 0
          ? companyId
          : undefined,
      search,
      sort,
      sortDir,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
