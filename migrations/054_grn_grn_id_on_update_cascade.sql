-- Allow updating inbound_grns.grn_id (e.g. Zap draft negative id → operational positive id).
-- Child FKs must use ON UPDATE CASCADE; denormalized tables are updated in application code.

DO $$
DECLARE
  r RECORD;
  def TEXT;
  newdef TEXT;
BEGIN
  FOR r IN
    SELECT c.oid, c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.confrelid = 'inbound_grns'::regclass
      AND c.contype = 'f'
  LOOP
    def := pg_get_constraintdef(r.oid);

    IF position('ON UPDATE CASCADE' IN def) > 0 THEN
      CONTINUE;
    END IF;

    newdef := def;
    IF position('ON DELETE CASCADE' IN newdef) > 0 THEN
      newdef := replace(newdef, 'ON DELETE CASCADE', 'ON DELETE CASCADE ON UPDATE CASCADE');
    ELSIF position('ON DELETE RESTRICT' IN newdef) > 0 THEN
      newdef := replace(newdef, 'ON DELETE RESTRICT', 'ON DELETE RESTRICT ON UPDATE CASCADE');
    ELSIF newdef ~ 'REFERENCES inbound_grns\(grn_id\)\s*$' THEN
      newdef := rtrim(newdef) || ' ON DELETE CASCADE ON UPDATE CASCADE';
    ELSE
      RAISE NOTICE '054: skip FK %.% (%) — add ON UPDATE CASCADE manually if needed', r.tbl, r.conname, def;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, newdef);
  END LOOP;
END $$;

-- Denormalized grn_id on debit note lines: align with inbound_grns PK updates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inbound_zap_debit_note_lines'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'inbound_zap_debit_note_lines'
      AND c.conname = 'inbound_zap_debit_note_lines_grn_id_fkey'
  ) THEN
    ALTER TABLE inbound_zap_debit_note_lines
      ADD CONSTRAINT inbound_zap_debit_note_lines_grn_id_fkey
      FOREIGN KEY (grn_id) REFERENCES inbound_grns(grn_id) ON DELETE CASCADE ON UPDATE CASCADE
      NOT VALID;
    ALTER TABLE inbound_zap_debit_note_lines
      VALIDATE CONSTRAINT inbound_zap_debit_note_lines_grn_id_fkey;
  END IF;
END $$;
