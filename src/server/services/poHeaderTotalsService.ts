import type { PoolClient } from "pg";
import { query } from "@/server/db";
import {
  ACCEPTED_QTY_KEYS,
  sqlPickQtyFromRaw,
} from "@/lib/inboundGrnQuantities";

export { computePoHeaderTotalsFromGrns } from "@/lib/inboundPoHeaderTotals";
export type { PoHeaderTotals } from "@/lib/inboundPoHeaderTotals";

/**
 * Recompute denormalized PO summary columns from inbound_grns (+ line SKUs for fill rate).
 * Only updates source='zap' rows — eAutomate PO totals remain owned by sync.
 */
const RECALC_SQL = `
UPDATE vendor_purchase_orders po SET
  number_of_grns = s.grn_count,
  total_invoice_quantity = s.invoice_qty,
  total_accepted_quantity = s.accepted_qty,
  total_rejected_quantity = s.rejected_qty,
  quantity_fill_rate = s.quantity_fill_rate,
  sku_fill_rate = s.sku_fill_rate,
  updated_at = NOW()
FROM (
  SELECT
    po2.po_id,
    COALESCE(g.grn_count, 0)::int AS grn_count,
    COALESCE(g.invoice_qty, 0)::int AS invoice_qty,
    COALESCE(g.accepted_qty, 0)::int AS accepted_qty,
    COALESCE(g.rejected_qty, 0)::int AS rejected_qty,
    CASE
      WHEN po2.total_quantity > 0 THEN
        ROUND((COALESCE(g.accepted_qty, 0)::numeric / po2.total_quantity::numeric) * 100, 2)
      ELSE 0
    END AS quantity_fill_rate,
    CASE
      WHEN po2.sku_count > 0 THEN
        ROUND((COALESCE(sku.skus_with_acceptance, 0)::numeric / po2.sku_count::numeric) * 100, 2)
      ELSE 0
    END AS sku_fill_rate
  FROM vendor_purchase_orders po2
  LEFT JOIN (
    SELECT
      ig.po_id,
      COUNT(*)::int AS grn_count,
      COALESCE(SUM(ig.grn_invoice_quantity), 0)::int AS invoice_qty,
      COALESCE(SUM(ig.grn_accepted_quantity), 0)::int AS accepted_qty,
      COALESCE(SUM(ig.grn_rejected_quantity), 0)::int AS rejected_qty
    FROM inbound_grns ig
    WHERE ig.po_id = $1
    GROUP BY ig.po_id
  ) g ON g.po_id = po2.po_id
  LEFT JOIN (
    SELECT
      ig.po_id,
      COUNT(DISTINCT i.sku_id)::int AS skus_with_acceptance
    FROM inbound_grns ig
    JOIN inbound_grn_items i ON i.grn_id = ig.grn_id
    WHERE ig.po_id = $1
      AND i.sku_id IS NOT NULL
      AND TRIM(i.sku_id) <> ''
      AND ${sqlPickQtyFromRaw("i", ACCEPTED_QTY_KEYS)} > 0
    GROUP BY ig.po_id
  ) sku ON sku.po_id = po2.po_id
  WHERE po2.po_id = $1
) s
WHERE po.po_id = s.po_id
  AND po.source = 'zap'
`;

export async function recalculatePoHeaderTotals(
  poIdRaw: unknown,
  client?: PoolClient
): Promise<void> {
  const poId = Number(poIdRaw);
  if (!Number.isFinite(poId) || poId < 1) return;

  const runner = client ?? null;
  if (runner) {
    await runner.query(RECALC_SQL, [poId]);
  } else {
    await query(RECALC_SQL, [poId]);
  }
}

/** Backfill Zap PO summary cards — used by migration 072. */
export const RECALC_ALL_ZAP_POS_SQL = `
UPDATE vendor_purchase_orders po SET
  number_of_grns = COALESCE(s.grn_count, 0),
  total_invoice_quantity = COALESCE(s.invoice_qty, 0),
  total_accepted_quantity = COALESCE(s.accepted_qty, 0),
  total_rejected_quantity = COALESCE(s.rejected_qty, 0),
  quantity_fill_rate = COALESCE(s.quantity_fill_rate, 0),
  sku_fill_rate = COALESCE(s.sku_fill_rate, 0),
  updated_at = NOW()
FROM (
  SELECT
    po2.po_id,
    g.grn_count,
    g.invoice_qty,
    g.accepted_qty,
    g.rejected_qty,
    CASE
      WHEN po2.total_quantity > 0 THEN
        ROUND((COALESCE(g.accepted_qty, 0)::numeric / po2.total_quantity::numeric) * 100, 2)
      ELSE 0
    END AS quantity_fill_rate,
    CASE
      WHEN po2.sku_count > 0 THEN
        ROUND((COALESCE(sku.skus_with_acceptance, 0)::numeric / po2.sku_count::numeric) * 100, 2)
      ELSE 0
    END AS sku_fill_rate
  FROM vendor_purchase_orders po2
  LEFT JOIN (
    SELECT
      ig.po_id,
      COUNT(*)::int AS grn_count,
      COALESCE(SUM(ig.grn_invoice_quantity), 0)::int AS invoice_qty,
      COALESCE(SUM(ig.grn_accepted_quantity), 0)::int AS accepted_qty,
      COALESCE(SUM(ig.grn_rejected_quantity), 0)::int AS rejected_qty
    FROM inbound_grns ig
    GROUP BY ig.po_id
  ) g ON g.po_id = po2.po_id
  LEFT JOIN (
    SELECT
      ig.po_id,
      COUNT(DISTINCT i.sku_id)::int AS skus_with_acceptance
    FROM inbound_grns ig
    JOIN inbound_grn_items i ON i.grn_id = ig.grn_id
    WHERE i.sku_id IS NOT NULL
      AND TRIM(i.sku_id) <> ''
      AND ${sqlPickQtyFromRaw("i", ACCEPTED_QTY_KEYS)} > 0
    GROUP BY ig.po_id
  ) sku ON sku.po_id = po2.po_id
  WHERE po2.source = 'zap'
) s
WHERE po.po_id = s.po_id
  AND po.source = 'zap';

UPDATE vendor_purchase_orders po SET
  number_of_grns = 0,
  total_invoice_quantity = 0,
  total_accepted_quantity = 0,
  total_rejected_quantity = 0,
  quantity_fill_rate = 0,
  sku_fill_rate = 0,
  updated_at = NOW()
WHERE po.source = 'zap'
  AND NOT EXISTS (SELECT 1 FROM inbound_grns ig WHERE ig.po_id = po.po_id);
`;
