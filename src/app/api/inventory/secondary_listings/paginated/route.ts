import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/rbac";
import { handleApiError } from "@/server/errors";
import * as inventoryService from "@/server/services/inventoryService";
import { parsePagination } from "@/server/validators/pagination";

const SECONDARY_SORTS = ["sku_asc", "sku_desc", "qty_asc", "qty_desc", "created_desc"] as const;
type SecondarySort = (typeof SECONDARY_SORTS)[number];

const SECONDARY_STOCK_STATES = ["in_stock", "out_of_stock"] as const;
type SecondaryStockState = (typeof SECONDARY_STOCK_STATES)[number];

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    assertPermission(user, "inventory", "read");
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const search_keyword = (q.search_keyword || "").trim();
    const sku_type = (q.sku_type || "").trim().toUpperCase() || undefined;
    const category = q.category ? String(q.category) : null;
    const sortRaw = q.sort ?? "";
    const sort: SecondarySort | null =
      (SECONDARY_SORTS as readonly string[]).includes(sortRaw)
        ? (sortRaw as SecondarySort)
        : null;
    const stockRaw = q.stock_state ?? "";
    const stockState: SecondaryStockState | null =
      (SECONDARY_STOCK_STATES as readonly string[]).includes(stockRaw)
        ? (stockRaw as SecondaryStockState)
        : null;
    const tagIds = q.tag_ids
      ? q.tag_ids.split(",").map(Number).filter((n: number) => !Number.isNaN(n))
      : undefined;
    const { page, limit } = parsePagination(q, {
      page: 1,
      limit: 2000,
      maxLimit: 2000,
    });
    const data = await inventoryService.getSecondaryListingsPaginated(
      search_keyword,
      page,
      limit,
      { skuType: sku_type, category, stockState, sort, tagIds }
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
