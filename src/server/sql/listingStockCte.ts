// Shared CTE fragment for filtering / sorting listings by their live stock
// position. Mirrors the columns produced by reorderService.METRICS_CTE so the
// stock-state filter and the qty/below-reorder sorts use the same definition
// across listings, secondary listings, and packs/combos pages.

export const LISTING_STOCK_CTE = `
  WITH
  ls_sales_30d AS (
    SELECT sku_id, SUM(quantity)::int AS qty
    FROM   warehouse_inventory_dump
    WHERE  inventory_operation_type = 'REMOVE'
      AND  (movement_type IS NULL OR movement_type = 'SALE')
      AND  created_at >= NOW() - INTERVAL '30 days'
    GROUP  BY sku_id
  ),
  ls_current_stock AS (
    SELECT sku_id, SUM(available_quantity)::int AS qty
    FROM   bins
    WHERE  is_deleted = false
    GROUP  BY sku_id
  ),
  ls_expected_inbound AS (
    SELECT sku_id, SUM(quantity)::int AS qty
    FROM   incoming_quantity
    GROUP  BY sku_id
  ),
  ls_stock AS (
    SELECT
      l.sku_id,
      COALESCE(cs.qty, 0)                                            AS bin_qty,
      COALESCE(cs.qty, 0) + COALESCE(ei.qty, 0)                      AS available_qty,
      COALESCE(s.qty, 0)                                              AS sold_30d,
      CASE
        WHEN COALESCE(rc.use_advanced, false) THEN
          GREATEST(0, ROUND(
            (COALESCE(s.qty, 0)::numeric / 30.0)
            * COALESCE(rc.lead_time_days, 7)
          ))::int
        ELSE COALESCE(s.qty, 0)
      END                                                             AS min_reorder_qty,
      (
        COALESCE(cs.qty, 0) + COALESCE(ei.qty, 0)
      ) < CASE
        WHEN COALESCE(rc.use_advanced, false) THEN
          GREATEST(0, ROUND(
            (COALESCE(s.qty, 0)::numeric / 30.0)
            * COALESCE(rc.lead_time_days, 7)
          ))::int
        ELSE COALESCE(s.qty, 0)
      END                                                             AS is_below_reorder
    FROM   listings l
    LEFT   JOIN ls_sales_30d        s  ON s.sku_id  = l.sku_id
    LEFT   JOIN ls_current_stock    cs ON cs.sku_id = l.sku_id
    LEFT   JOIN ls_expected_inbound ei ON ei.sku_id = l.sku_id
    LEFT   JOIN sku_reorder_config  rc ON rc.sku_id = l.sku_id
  )
`;

export type StockState = "in_stock" | "out_of_stock" | "below_reorder";

/**
 * SQL fragment to filter against `ls_stock` (use as `s` in the outer query).
 * Returns empty string when no filter is applied.
 */
export function stockStateClause(state: StockState | null | undefined, alias = "s"): string {
  if (!state) return "";
  if (state === "in_stock") return `${alias}.bin_qty > 0`;
  if (state === "out_of_stock") return `${alias}.bin_qty = 0`;
  return `${alias}.is_below_reorder = true`;
}

export const LISTING_SORT_ORDERS = [
  "sku_asc",
  "sku_desc",
  "qty_asc",
  "qty_desc",
  "created_desc",
] as const;
export type ListingSort = (typeof LISTING_SORT_ORDERS)[number];

/**
 * Whitelisted ORDER BY fragment. Caller composes the outer SELECT so it
 * controls which alias is in scope (l for listings, s for stock CTE).
 */
export function listingOrderBy(sort: ListingSort | null | undefined): string {
  switch (sort) {
    case "sku_desc":
      return "l.sku_id DESC";
    case "qty_asc":
      return "s.bin_qty ASC NULLS FIRST, l.sku_id ASC";
    case "qty_desc":
      return "s.bin_qty DESC NULLS LAST, l.sku_id ASC";
    case "created_desc":
      return "l.created_at DESC NULLS LAST, l.sku_id ASC";
    case "sku_asc":
    default:
      return "l.sku_id ASC";
  }
}
