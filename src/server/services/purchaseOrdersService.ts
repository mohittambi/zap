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

/** Aggregates for SKU outbound / order summary (listing_order_details). */
export async function getOutboundOrderSummaryForSku(skuId) {
  const unitExpr = `CASE
    WHEN COALESCE(rate_without_tax, 0) > 0 THEN rate_without_tax * (1 + COALESCE(tax_rate, 0) / 100.0)
    ELSE COALESCE(mrp, 0)
  END`;

  const overallR = await query(
    `SELECT
       COALESCE(SUM(COALESCE(demand, 0)), 0)::bigint AS total_demand,
       COALESCE(SUM(COALESCE(dispatched_quantity, 0)), 0)::bigint AS total_fulfilled,
       COALESCE(
         SUM(GREATEST(0, COALESCE(demand, 0) - COALESCE(dispatched_quantity, 0))),
         0
       )::bigint AS total_unfulfilled,
       COALESCE(
         SUM(COALESCE(dispatched_quantity, 0) * (${unitExpr})),
         0
       )::numeric AS revenue_gain,
       COALESCE(
         SUM(
           GREATEST(0, COALESCE(demand, 0) - COALESCE(dispatched_quantity, 0)) * (${unitExpr})
         ),
         0
       )::numeric AS revenue_loss
     FROM listing_order_details
     WHERE po_secondary_sku = $1`,
    [skuId]
  );

  const o = overallR.rows[0];
  const totalDemand = Number(o.total_demand);
  const revenueGain = Number(o.revenue_gain);
  const revenueLoss = Number(o.revenue_loss);
  const denom = revenueGain + revenueLoss;
  const avgPrice =
    totalDemand > 0 ? (revenueGain + revenueLoss) / totalDemand : null;
  const lossPct =
    denom > 0 ? (100 * revenueLoss) / denom : null;

  const overall = {
    company: "Overall",
    total_demand: totalDemand,
    total_fulfilled: Number(o.total_fulfilled),
    total_unfulfilled: Number(o.total_unfulfilled),
    revenue_gain: revenueGain,
    revenue_loss: revenueLoss,
    avg_price_incl_tax: avgPrice != null && Number.isFinite(avgPrice) ? avgPrice : null,
    loss_pct: lossPct != null && Number.isFinite(lossPct) ? lossPct : null,
  };

  const byCompanyR = await query(
    `SELECT
       COALESCE(NULLIF(TRIM(company_name), ''), 'Unknown') AS company,
       COALESCE(SUM(COALESCE(demand, 0)), 0)::bigint AS total_demand,
       COALESCE(SUM(COALESCE(dispatched_quantity, 0)), 0)::bigint AS total_fulfilled,
       COALESCE(
         SUM(GREATEST(0, COALESCE(demand, 0) - COALESCE(dispatched_quantity, 0))),
         0
       )::bigint AS total_unfulfilled,
       COALESCE(
         SUM(COALESCE(dispatched_quantity, 0) * (${unitExpr})),
         0
       )::numeric AS revenue_gain,
       COALESCE(
         SUM(
           GREATEST(0, COALESCE(demand, 0) - COALESCE(dispatched_quantity, 0)) * (${unitExpr})
         ),
         0
       )::numeric AS revenue_loss
     FROM listing_order_details
     WHERE po_secondary_sku = $1
     GROUP BY 1
     ORDER BY 1`,
    [skuId]
  );

  const by_company = byCompanyR.rows.map((r) => {
    const td = Number(r.total_demand);
    const rg = Number(r.revenue_gain);
    const rl = Number(r.revenue_loss);
    const d = rg + rl;
    return {
      company: r.company,
      total_demand: td,
      total_fulfilled: Number(r.total_fulfilled),
      total_unfulfilled: Number(r.total_unfulfilled),
      revenue_gain: rg,
      revenue_loss: rl,
      avg_price_incl_tax:
        td > 0 && Number.isFinite((rg + rl) / td) ? (rg + rl) / td : null,
      loss_pct: d > 0 && Number.isFinite((100 * rl) / d) ? (100 * rl) / d : null,
    };
  });

  return { overall, by_company };
}
