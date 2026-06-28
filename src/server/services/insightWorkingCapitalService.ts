import { query } from "@/server/db";
import {
  computeWorkingCapitalSummary,
  resolveUnitCost,
} from "@/lib/workingCapital";

export async function getWorkingCapitalAnalysis(limit = 100) {
  const onHandR = await query(
    `SELECT l.sku_id, l.description, l.bulk_price,
            COALESCE(SUM(b.available_quantity), 0)::int AS on_hand_qty
     FROM listings l
     LEFT JOIN bins b ON b.sku_id = l.sku_id AND b.is_deleted = false
     GROUP BY l.sku_id, l.description, l.bulk_price
     HAVING COALESCE(SUM(b.available_quantity), 0) > 0`
  );

  const priceR = await query(
    `SELECT DISTINCT ON (i.sku_id)
            i.sku_id,
            (i.raw->>'received_price')::numeric AS received_price
     FROM inbound_grn_items i
     JOIN inbound_grns g ON g.grn_id = i.grn_id
     WHERE i.sku_id IS NOT NULL
       AND (i.raw->>'received_price') IS NOT NULL
     ORDER BY i.sku_id, g.created_at DESC NULLS LAST`
  );
  const priceMap = new Map<string, number>();
  for (const row of priceR.rows) {
    priceMap.set(String(row.sku_id), Number(row.received_price));
  }

  const deadR = await query(
    `WITH last_sale AS (
       SELECT sku_id, MAX(created_at) AS last_sale_at
       FROM warehouse_inventory_dump
       WHERE inventory_operation_type = 'REMOVE'
         AND (movement_type IS NULL OR movement_type = 'SALE')
       GROUP BY sku_id
     )
     SELECT l.sku_id
     FROM listings l
     LEFT JOIN last_sale ls ON ls.sku_id = l.sku_id
     WHERE ls.last_sale_at IS NULL OR ls.last_sale_at < NOW() - INTERVAL '60 days'`
  );
  const deadSet = new Set(deadR.rows.map((r) => String(r.sku_id)));

  const soldR = await query(
    `SELECT COALESCE(SUM(quantity), 0)::numeric AS sold_30d
     FROM warehouse_inventory_dump
     WHERE inventory_operation_type = 'REMOVE'
       AND (movement_type IS NULL OR movement_type = 'SALE')
       AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const sold_30d_total = Number(soldR.rows[0]?.sold_30d ?? 0);

  const rows = onHandR.rows.slice(0, limit).map((row) => {
    const sku_id = String(row.sku_id);
    const unit_cost = resolveUnitCost(
      priceMap.get(sku_id),
      Number(row.bulk_price) || null
    );
    return {
      sku_id,
      description: row.description == null ? null : String(row.description),
      on_hand_qty: Number(row.on_hand_qty),
      unit_cost,
      is_dead_stock: deadSet.has(sku_id),
    };
  });

  return computeWorkingCapitalSummary({ rows, sold_30d_total });
}
