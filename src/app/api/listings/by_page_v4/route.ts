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
