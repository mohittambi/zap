import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as companySkuService from "@/server/services/companySkuService";
import { parsePagination } from "@/server/validators/pagination";

/**
 * @swagger
 * /company-sku-relations:
 *   get:
 *     summary: List company-SKU relations (paginated)
 *     description: Requires company_relations:read.
 *     tags: [Company SKU Relations]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 500 } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: company_id, schema: { type: integer } }
 *       - { in: query, name: sort, schema: { type: string, enum: [sku_asc, sku_desc, company_asc, company_desc] } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "company_relations", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 100,
      maxLimit: 500,
    });
    const validSorts = new Set(["sku_asc", "sku_desc", "company_asc", "company_desc"]);
    const sort = validSorts.has(q.sort)
      ? (q.sort as "sku_asc" | "sku_desc" | "company_asc" | "company_desc")
      : null;
    const companyIdRaw = q.company_id ? Number(q.company_id) : null;
    const company_id =
      companyIdRaw != null && Number.isFinite(companyIdRaw) ? companyIdRaw : null;
    const data = await companySkuService.listCompanySkuRelations({
      search_keyword: (q.search_keyword || "").trim(),
      page,
      limit,
      company_id,
      sort,
    });
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
