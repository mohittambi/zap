// @ts-nocheck
import { query } from "@/server/db";

export async function getPackComboBySku(skuId) {
  const result = await query(
    `SELECT id, parent_sku_id, component_sku_id, quantity, created_at
     FROM pack_combos WHERE parent_sku_id = $1`,
    [skuId]
  );
  return result.rows;
}

/**
 * Components with listing images/stock + effective bundle quantity (min floor(avail/qty)).
 */
export async function getPackComboDetailForParent(parentSkuId) {
  const rows = await query(
    `SELECT pc.id, pc.parent_sku_id, pc.component_sku_id, pc.quantity, pc.created_at,
            l.sku_id, l.description, l.img_hd, l.img_white, l.available_quantity
     FROM pack_combos pc
     JOIN listings l ON l.sku_id = pc.component_sku_id
     WHERE pc.parent_sku_id = $1
     ORDER BY pc.id`,
    [parentSkuId]
  );
  const components = rows.rows.map((r) => ({
    id: Number(r.id),
    parent_sku_id: r.parent_sku_id,
    component_sku_id: r.component_sku_id,
    quantity: Number(r.quantity ?? 1),
    created_at: r.created_at,
    listing: {
      sku_id: r.sku_id,
      description: r.description,
      img_hd: r.img_hd,
      img_white: r.img_white,
      available_quantity: Number(r.available_quantity ?? 0),
    },
  }));
  let effective_available_quantity = Infinity;
  for (const c of components) {
    const q = Math.max(1, Number(c.quantity) || 1);
    const avail = Number(c.listing.available_quantity ?? 0);
    const floor = Math.floor(avail / q);
    effective_available_quantity = Math.min(effective_available_quantity, floor);
  }
  if (!Number.isFinite(effective_available_quantity)) effective_available_quantity = 0;
  return {
    pack_combo_sku_id: parentSkuId,
    components,
    effective_available_quantity,
  };
}
