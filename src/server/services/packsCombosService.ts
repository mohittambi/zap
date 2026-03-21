// @ts-nocheck
import { query } from '@/server/db';

export async function getPackComboBySku(skuId) {
  const result = await query(
    `SELECT id, parent_sku_id, component_sku_id, quantity, created_at
     FROM pack_combos WHERE parent_sku_id = $1`,
    [skuId]
  );
  return result.rows;
}
