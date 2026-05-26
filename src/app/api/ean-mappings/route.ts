import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import { parsePagination } from "@/server/validators/pagination";
import {
  countEanMappingsSummary,
  listEanMappingsPaginated,
} from "@/server/services/eanMappingsService";

/**
 * @swagger
 * /ean-mappings:
 *   get:
 *     summary: Paginated company EAN mappings
 *     tags: [Settings]
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "*", "*");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const companyId =
      q.company_id != null && q.company_id !== ""
        ? Number(q.company_id)
        : undefined;
    const search = typeof q.search === "string" ? q.search : undefined;

    const [data, summary] = await Promise.all([
      listEanMappingsPaginated({
        page,
        limit,
        companyId:
          companyId != null && Number.isFinite(companyId) && companyId > 0
            ? companyId
            : undefined,
        search,
      }),
      countEanMappingsSummary({
        companyId:
          companyId != null && Number.isFinite(companyId) && companyId > 0
            ? companyId
            : undefined,
      }),
    ]);

    return NextResponse.json({ ...data, summary });
  } catch (err) {
    return handleApiError(err);
  }
}
