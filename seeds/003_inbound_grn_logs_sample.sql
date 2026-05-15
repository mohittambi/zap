-- Optional sample rows for inbound_grn_logs (local/demo only).
-- Activity in production is appended by Zap when users act on GRNs; run migration 056 for log_id sequence first.
-- Safe to run multiple times (ON CONFLICT DO NOTHING). Requires inbound_grns and inbound_grn_logs.

DO $$
DECLARE
  demo_grn BIGINT;
BEGIN
  SELECT grn_id INTO demo_grn FROM inbound_grns ORDER BY grn_id LIMIT 1;
  IF demo_grn IS NULL THEN
    RAISE NOTICE '003_inbound_grn_logs_sample: skipped (no inbound_grns row)';
    RETURN;
  END IF;

  INSERT INTO inbound_grn_logs (
    grn_id, log_id, line_index, log_type, operation_performed, po_id, vendor_id, foreign_key,
    sku_id, invoice_quantity, accepted_quantity, rejected_quantity, received_price,
    remarks, created_by, created_at, updated_at, raw
  ) VALUES
    (
      demo_grn,
      99000001,
      0,
      'RECEIPT',
      'Example: GRN synced from warehouse',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      'Seed: initial sync',
      'seed@local',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days',
      '{"seed": true, "operation_performed": "GRN synced from warehouse"}'::jsonb
    ),
    (
      demo_grn,
      99000002,
      1,
      'AUDIT',
      'Quantity updated',
      NULL,
      NULL,
      NULL,
      'SEED-SKU-001',
      10,
      9,
      1,
      NULL,
      'Seed: partial acceptance',
      'seed@local',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{"seed": true, "operation_performed": "Quantity updated"}'::jsonb
    )
  ON CONFLICT (grn_id, log_id) DO NOTHING;
END
$$;
