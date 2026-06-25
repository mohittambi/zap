import type { PoolClient } from "pg";
import { query } from "@/server/db";
import {
  ACCEPTED_QTY_KEYS,
  INVOICE_QTY_KEYS,
  REJECTED_QTY_KEYS,
  SHORT_QTY_KEYS,
  sqlPickQtyFromRaw,
} from "@/lib/inboundGrnQuantities";

export { computeGrnHeaderTotalsFromItems } from "@/lib/inboundGrnQuantities";
export type { GrnHeaderTotals } from "@/lib/inboundGrnQuantities";

const RECALC_SQL = `
UPDATE inbound_grns g SET
  grn_sku_count = s.sku_count,
  grn_invoice_quantity = s.invoice_qty,
  grn_accepted_quantity = s.accepted_qty,
  grn_rejected_quantity = s.rejected_qty,
  grn_shortage_quantity = s.shortage_qty,
  zap_receipt_exception = s.has_exception,
  updated_at = NOW()
FROM (
  SELECT
    COUNT(*)::int AS sku_count,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", INVOICE_QTY_KEYS)}), 0)::int AS invoice_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", ACCEPTED_QTY_KEYS)}), 0)::int AS accepted_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", REJECTED_QTY_KEYS)}), 0)::int AS rejected_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", SHORT_QTY_KEYS)}), 0)::int AS shortage_qty,
    COALESCE(
      BOOL_OR(
        ${sqlPickQtyFromRaw("i", REJECTED_QTY_KEYS)} > 0
        OR ${sqlPickQtyFromRaw("i", SHORT_QTY_KEYS)} > 0
      ),
      false
    ) AS has_exception
  FROM inbound_grn_items i
  WHERE i.grn_id = $1
) s
WHERE g.grn_id = $1
`;

/**
 * Recompute denormalized quantity columns on inbound_grns from inbound_grn_items.
 * Safe to call after line edits, seeding, close, or audit transitions.
 */
export async function recalculateGrnHeaderTotals(
  grnIdRaw: unknown,
  client?: PoolClient
): Promise<void> {
  const grnId = Number(grnIdRaw);
  if (!Number.isFinite(grnId) || grnId === 0) return;

  const runner = client ?? null;
  if (runner) {
    await runner.query(RECALC_SQL, [grnId]);
  } else {
    await query(RECALC_SQL, [grnId]);
  }
}

/** Backfill all GRNs — used by migration 071. */
export const RECALC_ALL_GRNS_SQL = `
UPDATE inbound_grns g SET
  grn_sku_count = COALESCE(s.sku_count, 0),
  grn_invoice_quantity = COALESCE(s.invoice_qty, 0),
  grn_accepted_quantity = COALESCE(s.accepted_qty, 0),
  grn_rejected_quantity = COALESCE(s.rejected_qty, 0),
  grn_shortage_quantity = COALESCE(s.shortage_qty, 0),
  zap_receipt_exception = COALESCE(s.has_exception, false),
  updated_at = NOW()
FROM (
  SELECT
    i.grn_id,
    COUNT(*)::int AS sku_count,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", INVOICE_QTY_KEYS)}), 0)::int AS invoice_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", ACCEPTED_QTY_KEYS)}), 0)::int AS accepted_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", REJECTED_QTY_KEYS)}), 0)::int AS rejected_qty,
    COALESCE(SUM(${sqlPickQtyFromRaw("i", SHORT_QTY_KEYS)}), 0)::int AS shortage_qty,
    COALESCE(
      BOOL_OR(
        ${sqlPickQtyFromRaw("i", REJECTED_QTY_KEYS)} > 0
        OR ${sqlPickQtyFromRaw("i", SHORT_QTY_KEYS)} > 0
      ),
      false
    ) AS has_exception
  FROM inbound_grn_items i
  GROUP BY i.grn_id
) s
WHERE g.grn_id = s.grn_id;

UPDATE inbound_grns g SET
  grn_sku_count = 0,
  grn_invoice_quantity = 0,
  grn_accepted_quantity = 0,
  grn_rejected_quantity = 0,
  grn_shortage_quantity = 0,
  zap_receipt_exception = false,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM inbound_grn_items i WHERE i.grn_id = g.grn_id
);
`;
