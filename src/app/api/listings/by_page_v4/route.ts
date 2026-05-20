import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as listingsService from "@/server/services/listingsService";
import { parsePagination } from "@/server/validators/pagination";
import {
  LISTING_SORT_ORDERS,
  type ListingSort,
  type StockState,
} from "@/server/sql/listingStockCte";

const STOCK_STATES: readonly StockState[] = ["in_stock", "out_of_stock", "below_reorder"];

function parseSort(raw: string | null): ListingSort | null {
  if (!raw) return null;
  return (LISTING_SORT_ORDERS as readonly string[]).includes(raw)
    ? (raw as ListingSort)
    : null;
}

function parseStockState(raw: string | null): StockState | null {
  if (!raw) return null;
  return (STOCK_STATES as readonly string[]).includes(raw) ? (raw as StockState) : null;
}

/**
 * @swagger
 * /listings/by_page_v4:
 *   get:
 *     summary: Paginated listings (search/filter/sort)
 *     description: Requires listings:read.
 *     tags: [Listings]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 100, maximum: 200 } }
 *       - { in: query, name: search_keyword, schema: { type: string } }
 *       - { in: query, name: tag_ids, schema: { type: string }, description: Comma-separated tag ids }
 *       - { in: query, name: min_price, schema: { type: number } }
 *       - { in: query, name: max_price, schema: { type: number } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: stock_state, schema: { type: string, enum: [in_stock, out_of_stock, below_reorder] } }
 *       - { in: query, name: sort, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
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
    const tag_ids = q.tag_ids
      ? q.tag_ids.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : undefined;
    const min_price = q.min_price ? Number(q.min_price) : undefined;
    const max_price = q.max_price ? Number(q.max_price) : undefined;
    const category = q.category ? String(q.category) : null;
    const stock_state = parseStockState(q.stock_state ?? null);
    const sort = parseSort(q.sort ?? null);
    const data = await listingsService.getListingsByPage(
      search_keyword,
      page,
      limit,
      { tag_ids, min_price, max_price, category, stock_state, sort }
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
