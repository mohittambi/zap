import { query } from "@/server/db";
import { forecastDemand } from "@/lib/demandForecast";
import { computeReorderRecommendation } from "@/lib/safetyStockEoq";
import { resolveUnitCost } from "@/lib/workingCapital";
import { getInsightConfig } from "./insightConfigService";
import { getReorderMetricForSku } from "./reorderService";

export async function getSkuForecastBundle(skuId: string) {
  const dailyR = await query(
    `SELECT date_trunc('day', created_at)::date::text AS day,
            SUM(quantity)::int AS qty
     FROM warehouse_inventory_dump
     WHERE sku_id = $1
       AND inventory_operation_type = 'REMOVE'
       AND (movement_type IS NULL OR movement_type = 'SALE')
       AND created_at >= NOW() - INTERVAL '120 days'
     GROUP BY 1
     ORDER BY 1`,
    [skuId]
  );

  const series = dailyR.rows.map((r) => Number(r.qty));
  const forecast = forecastDemand(series, 14);

  const reorder = await getReorderMetricForSku(skuId);
  const config = await getInsightConfig();

  const priceR = await query(
    `SELECT bulk_price FROM listings WHERE sku_id = $1 LIMIT 1`,
    [skuId]
  );
  const grnPriceR = await query(
    `SELECT (i.raw->>'received_price')::numeric AS received_price
     FROM inbound_grn_items i
     JOIN inbound_grns g ON g.grn_id = i.grn_id
     WHERE i.sku_id = $1 AND (i.raw->>'received_price') IS NOT NULL
     ORDER BY g.created_at DESC NULLS LAST LIMIT 1`,
    [skuId]
  );

  const unitCost = resolveUnitCost(
    grnPriceR.rows[0]?.received_price != null
      ? Number(grnPriceR.rows[0].received_price)
      : null,
    priceR.rows[0]?.bulk_price != null ? Number(priceR.rows[0].bulk_price) : null
  );

  const avgDaily =
    series.length > 0
      ? series.reduce((s, v) => s + v, 0) / series.length
      : reorder?.sold_30d
        ? reorder.sold_30d / 30
        : 0;
  const mean = avgDaily;
  const variance =
    series.length > 1
      ? series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length
      : 0;
  const stdDev = Math.sqrt(variance);

  const smartReorder = computeReorderRecommendation({
    avgDailyDemand: avgDaily,
    demandStdDevDaily: stdDev,
    leadTimeDays: reorder?.lead_time_days ?? 7,
    onHand: reorder?.available_qty ?? 0,
    orderingCost: config.ordering_cost_default,
    unitCost,
    holdingCostPct: config.holding_cost_pct_default,
  });

  return {
    sku_id: skuId,
    forecast,
    reorder: reorder ?? null,
    smart_reorder: smartReorder,
    unit_cost: unitCost,
  };
}
