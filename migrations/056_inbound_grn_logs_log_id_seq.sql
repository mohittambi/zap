-- Sequence for Zap-originated inbound_grn_logs.log_id (avoids races vs MAX+1).

CREATE SEQUENCE IF NOT EXISTS inbound_grn_logs_log_id_seq;

DO $$
DECLARE
  mx bigint;
BEGIN
  SELECT MAX(log_id) INTO mx FROM inbound_grn_logs;
  IF mx IS NULL THEN
    PERFORM setval('inbound_grn_logs_log_id_seq', 1, false);
  ELSE
    PERFORM setval('inbound_grn_logs_log_id_seq', mx, true);
  END IF;
END $$;
