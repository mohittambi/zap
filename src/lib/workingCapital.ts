export type WorkingCapitalRow = {
  sku_id: string;
  description: string | null;
  on_hand_qty: number;
  unit_cost: number;
  capital_tied: number;
  is_dead_stock: boolean;
};

export type WorkingCapitalSummary = {
  total_capital_tied: number;
  dead_stock_capital: number;
  avg_inventory_units: number;
  cogs_per_day: number;
  dio_days: number | null;
  rows: WorkingCapitalRow[];
};

export function resolveUnitCost(
  grnReceivedPrice: number | null | undefined,
  bulkPrice: number | null | undefined
): number {
  if (grnReceivedPrice != null && grnReceivedPrice > 0) return grnReceivedPrice;
  if (bulkPrice != null && bulkPrice > 0) return bulkPrice;
  return 0;
}

export function computeWorkingCapitalSummary(opts: {
  rows: Array<{
    sku_id: string;
    description: string | null;
    on_hand_qty: number;
    unit_cost: number;
    is_dead_stock: boolean;
  }>;
  sold_30d_total: number;
}): WorkingCapitalSummary {
  const enriched: WorkingCapitalRow[] = opts.rows.map((r) => ({
    ...r,
    capital_tied: r.on_hand_qty * r.unit_cost,
  }));

  const total_capital_tied = enriched.reduce((s, r) => s + r.capital_tied, 0);
  const dead_stock_capital = enriched
    .filter((r) => r.is_dead_stock)
    .reduce((s, r) => s + r.capital_tied, 0);
  const avg_inventory_units = enriched.reduce((s, r) => s + r.on_hand_qty, 0);
  const cogs_per_day = opts.sold_30d_total / 30;
  const dio_days =
    cogs_per_day > 0 ? total_capital_tied / cogs_per_day : null;

  return {
    total_capital_tied,
    dead_stock_capital,
    avg_inventory_units,
    cogs_per_day,
    dio_days,
    rows: enriched.sort((a, b) => b.capital_tied - a.capital_tied),
  };
}
