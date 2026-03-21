// @ts-nocheck
import { query } from '@/server/db';

export async function getListingOrderDetailsBySku(skuId, page, count) {
  const offset = (page - 1) * count;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM listing_order_details WHERE po_secondary_sku = $1`,
    [skuId]
  );
  const total = countResult.rows[0].total;

  const listResult = await query(
    `SELECT id, po_number, po_secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
            sku_type, company_code_primary, company_code_secondary, demand, hsn_code, title,
            mrp, rate_without_tax, tax_rate, size, color, created_by, created_at, updated_at,
            dispatched_quantity, packed_quantity, company_name, delivery_city,
            po_issue_date, expiry_date, po_type, calculated_po_status
     FROM listing_order_details
     WHERE po_secondary_sku = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [skuId, count, offset]
  );

  const content = listResult.rows.map((r) => ({
    id: Number(r.id),
    po_number: r.po_number,
    po_secondary_sku: r.po_secondary_sku,
    master_sku: r.master_sku,
    inventory_sku_id: r.inventory_sku_id,
    pack_combo_sku_id: r.pack_combo_sku_id,
    sku_type: r.sku_type,
    company_code_primary: r.company_code_primary,
    company_code_secondary: r.company_code_secondary,
    demand: r.demand,
    hsn_code: r.hsn_code,
    title: r.title,
    mrp: Number(r.mrp ?? 0),
    rate_without_tax: Number(r.rate_without_tax ?? 0),
    tax_rate: Number(r.tax_rate ?? 0),
    size: r.size,
    color: r.color,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    dispatched_quantity: r.dispatched_quantity,
    packed_quantity: r.packed_quantity,
    company_name: r.company_name,
    delivery_city: r.delivery_city,
    po_issue_date: r.po_issue_date,
    expiry_date: r.expiry_date,
    po_type: r.po_type,
    calculated_po_status: r.calculated_po_status,
  }));

  return {
    total,
    current_page: page,
    per_page_count: count,
    curr_page_count: content.length,
    content,
  };
}
