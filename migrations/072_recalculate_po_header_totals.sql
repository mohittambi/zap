-- Backfill vendor_purchase_orders summary totals from inbound_grns for Zap-source POs.
-- eAutomate PO totals remain owned by sync; only source='zap' rows are updated.

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
      AND COALESCE(
        NULLIF(TRIM(i.raw->>'accepted_quantity'), '')::numeric,
        NULLIF(TRIM(i.raw->>'acceptedQuantity'), '')::numeric,
        NULLIF(TRIM(i.raw->>'grn_accepted_quantity'), '')::numeric,
        NULLIF(TRIM(i.raw->>'current_grn_accepted_quantity'), '')::numeric,
        NULLIF(TRIM(i.raw->>'currentGrnAcceptedQuantity'), '')::numeric,
        0
      ) > 0
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
