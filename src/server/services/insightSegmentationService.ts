import { query } from "@/server/db";
import { classifySkusAbcXyz } from "@/lib/abcXyzClassification";

export async function getSkuSegmentation(limit = 200) {
  const salesR = await query(
    `SELECT sku_id,
            SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::numeric AS sold_30d
     FROM warehouse_inventory_dump
     WHERE inventory_operation_type = 'REMOVE'
       AND (movement_type IS NULL OR movement_type = 'SALE')
       AND created_at >= NOW() - INTERVAL '90 days'
     GROUP BY sku_id
     HAVING SUM(quantity) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') > 0
     ORDER BY sold_30d DESC
     LIMIT $1`,
    [Math.min(500, Math.max(limit, 50))]
  );

  const skuIds = salesR.rows.map((row) => String(row.sku_id));
  if (skuIds.length === 0) {
    const matrix = { AX: 0, AY: 0, AZ: 0, BX: 0, BY: 0, BZ: 0, CX: 0, CY: 0, CZ: 0 };
    return { matrix, segments: [] };
  }

  const [seriesR, priceR, bulkR] = await Promise.all([
    query(
      `SELECT sku_id,
              date_trunc('week', created_at)::date::text AS week,
              SUM(quantity)::int AS qty
       FROM warehouse_inventory_dump
       WHERE inventory_operation_type = 'REMOVE'
         AND (movement_type IS NULL OR movement_type = 'SALE')
         AND created_at >= NOW() - INTERVAL '90 days'
         AND sku_id = ANY($1::text[])
       GROUP BY sku_id, 2`,
      [skuIds]
    ),
    query(
      `SELECT DISTINCT ON (i.sku_id)
              i.sku_id,
              (i.raw->>'received_price')::numeric AS received_price
       FROM inbound_grn_items i
       JOIN inbound_grns g ON g.grn_id = i.grn_id
       WHERE i.sku_id = ANY($1::text[])
         AND (i.raw->>'received_price') IS NOT NULL
       ORDER BY i.sku_id, g.created_at DESC NULLS LAST`,
      [skuIds]
    ),
    query(
      `SELECT sku_id, COALESCE(bulk_price, 0)::numeric AS bulk_price
       FROM listings
       WHERE sku_id = ANY($1::text[])`,
      [skuIds]
    ),
  ]);

  const priceMap = new Map<string, number>();
  for (const row of bulkR.rows) {
    priceMap.set(String(row.sku_id), Number(row.bulk_price) || 0);
  }
  for (const row of priceR.rows) {
    const rp = row.received_price != null ? Number(row.received_price) : null;
    if (rp != null && rp > 0) {
      priceMap.set(String(row.sku_id), rp);
    }
  }

  const seriesMap = new Map<string, number[]>();
  for (const row of seriesR.rows) {
    const sku = String(row.sku_id);
    const arr = seriesMap.get(sku) ?? [];
    arr.push(Number(row.qty));
    seriesMap.set(sku, arr);
  }

  const inputs = salesR.rows.map((row) => {
    const sku_id = String(row.sku_id);
    const sold = Number(row.sold_30d) || 0;
    const unit = priceMap.get(sku_id) ?? 0;
    return {
      sku_id,
      value_30d: sold * unit,
      demand_series: seriesMap.get(sku_id) ?? (sold > 0 ? [sold] : [0]),
    };
  });

  const segments = classifySkusAbcXyz(inputs).slice(0, limit);
  const matrix = { AX: 0, AY: 0, AZ: 0, BX: 0, BY: 0, BZ: 0, CX: 0, CY: 0, CZ: 0 };
  for (const s of segments) {
    const key = `${s.abc}${s.xyz}` as keyof typeof matrix;
    matrix[key] = (matrix[key] ?? 0) + 1;
  }

  return { matrix, segments };
}
