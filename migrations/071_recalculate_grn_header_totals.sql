-- Backfill inbound_grns header quantity aggregates from inbound_grn_items.
-- Idempotent: safe to re-run; matches runtime recalculateGrnHeaderTotals logic.

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
    COALESCE(SUM(COALESCE(
      NULLIF(TRIM(i.raw->>'invoice_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'invoiceQuantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'grn_invoice_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'current_grn_invoice_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'currentInvoiceQuantity'), '')::numeric,
      0
    )), 0)::int AS invoice_qty,
    COALESCE(SUM(COALESCE(
      NULLIF(TRIM(i.raw->>'accepted_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'acceptedQuantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'grn_accepted_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'current_grn_accepted_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'currentGrnAcceptedQuantity'), '')::numeric,
      0
    )), 0)::int AS accepted_qty,
    COALESCE(SUM(COALESCE(
      NULLIF(TRIM(i.raw->>'rejected_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'rejectedQuantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'grn_rejected_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'current_grn_rejected_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'currentGrnRejectedQuantity'), '')::numeric,
      0
    )), 0)::int AS rejected_qty,
    COALESCE(SUM(COALESCE(
      NULLIF(TRIM(i.raw->>'shortage_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'shortageQuantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'grn_shortage_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'current_grn_shortage_quantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'currentGrnShortageQuantity'), '')::numeric,
      NULLIF(TRIM(i.raw->>'short_quantity'), '')::numeric,
      0
    )), 0)::int AS shortage_qty,
    COALESCE(
      BOOL_OR(
        COALESCE(
          NULLIF(TRIM(i.raw->>'rejected_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'rejectedQuantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'grn_rejected_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'current_grn_rejected_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'currentGrnRejectedQuantity'), '')::numeric,
          0
        ) > 0
        OR COALESCE(
          NULLIF(TRIM(i.raw->>'shortage_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'shortageQuantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'grn_shortage_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'current_grn_shortage_quantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'currentGrnShortageQuantity'), '')::numeric,
          NULLIF(TRIM(i.raw->>'short_quantity'), '')::numeric,
          0
        ) > 0
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
