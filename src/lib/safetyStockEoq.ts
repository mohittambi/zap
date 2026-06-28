/** z for ~95% service level */
const DEFAULT_Z = 1.65;

export type ReorderRecommendation = {
  safety_stock: number;
  reorder_point: number;
  eoq: number;
  suggested_order_qty: number;
};

export function computeSafetyStock(
  dailyDemandStdDev: number,
  leadTimeDays: number,
  z = DEFAULT_Z
): number {
  if (dailyDemandStdDev <= 0 || leadTimeDays <= 0) return 0;
  return Math.ceil(z * dailyDemandStdDev * Math.sqrt(leadTimeDays));
}

export function computeEoq(
  annualDemand: number,
  orderingCost: number,
  holdingCostPerUnit: number
): number {
  if (annualDemand <= 0 || orderingCost <= 0 || holdingCostPerUnit <= 0) return 0;
  return Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit));
}

export function computeReorderRecommendation(opts: {
  avgDailyDemand: number;
  demandStdDevDaily: number;
  leadTimeDays: number;
  onHand: number;
  orderingCost: number;
  unitCost: number;
  holdingCostPct: number;
}): ReorderRecommendation {
  const safety_stock = computeSafetyStock(
    opts.demandStdDevDaily,
    opts.leadTimeDays
  );
  const reorder_point = Math.ceil(
    opts.avgDailyDemand * opts.leadTimeDays + safety_stock
  );
  const annualDemand = opts.avgDailyDemand * 365;
  const holdingCostPerUnit = opts.unitCost * opts.holdingCostPct;
  const eoq = computeEoq(annualDemand, opts.orderingCost, holdingCostPerUnit);
  const deficit = Math.max(0, reorder_point - opts.onHand);
  const suggested_order_qty = Math.max(deficit, eoq > 0 ? eoq : deficit);

  return {
    safety_stock,
    reorder_point,
    eoq,
    suggested_order_qty,
  };
}
