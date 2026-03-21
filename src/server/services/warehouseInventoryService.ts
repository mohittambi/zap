// @ts-nocheck
import { query } from '@/server/db';

export async function getWarehouseInventoryBySku(skuId, page, count) {
  const offset = (page - 1) * count;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM warehouse_inventory_dump WHERE sku_id = $1`,
    [skuId]
  );
  const total = countResult.rows[0].total;

  const listResult = await query(
    `SELECT warehouse_id, sku_id, inventory_operation_type, quantity, bin_id, user_id, created_at, updated_at
     FROM warehouse_inventory_dump
     WHERE sku_id = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [skuId, count, offset]
  );
  const content = listResult.rows.map((r) => ({
    warehouse_id: Number(r.warehouse_id),
    sku_id: r.sku_id,
    inventory_operation_type: r.inventory_operation_type,
    quantity: r.quantity,
    bin_id: r.bin_id,
    user_id: r.user_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return {
    total,
    current_page: page,
    per_page_count: count,
    curr_page_count: content.length,
    content,
  };
}
