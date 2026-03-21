// @ts-nocheck
import { query } from '@/server/db';

export async function getSkuAnalytics(skuId) {
  const result = await query(
    `SELECT inward_30d, inward_60d, inward_90d, outward_30d, outward_60d, outward_90d, fetched_at
     FROM sku_analytics
     WHERE sku_id = $1
     ORDER BY fetched_at DESC
     LIMIT 1`,
    [skuId]
  );
  const row = result.rows[0];
  if (!row) {
    return {
      inward_30d: 0,
      inward_60d: 0,
      inward_90d: 0,
      outward_30d: 0,
      outward_60d: 0,
      outward_90d: 0,
    };
  }
  return {
    inward_30d: row.inward_30d,
    inward_60d: row.inward_60d,
    inward_90d: row.inward_90d,
    outward_30d: row.outward_30d,
    outward_60d: row.outward_60d,
    outward_90d: row.outward_90d,
  };
}
