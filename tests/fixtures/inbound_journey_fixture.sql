-- Inbound journey deterministic fixtures — numeric band 988877xxx
-- Apply: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f web/tests/fixtures/inbound_journey_fixture.sql
--
-- Successful POST /register-operational replaces draft -988877301 with 988877301;
-- re-run this script to reset that flow.
-- GRN 988877111 is OPEN with invoice + rate diff: integration test POST /close consumes it — re-seed to repeat.
-- GRN 988877112 is OPEN with invoice + matched prices: close succeeds with no Zap DN (422 path).

BEGIN;

DELETE FROM inbound_grn_debit_credit_note_files
  WHERE grn_id IN (988877104, 988877301);

DELETE FROM inbound_grn_debit_credit_notes
  WHERE grn_id IN (988877104, -988877301, 988877301);

DELETE FROM inbound_pending_debit_credit_notes
  WHERE note_id = 988877501 OR grn_id IN (-988877301, 988877301, 988877104);

DELETE FROM inbound_grn_items
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_grn_invoice_files
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_grn_detail_snapshot
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_grn_pending_audit
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_grn_pending_invoice_collection
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_grn_pending_accounts_approval
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_po_detail_grns
  WHERE po_id = 988877900 OR grn_id IN (-988877301, 988877301);

DELETE FROM inbound_po_detail_lines
  WHERE po_id = 988877900;

DELETE FROM inbound_grns
  WHERE grn_id IN (
    988877101, 988877102, 988877103, 988877104, 988877111, 988877112, -988877301, 988877301
  );

DELETE FROM inbound_po_detail_snapshot
  WHERE po_id = 988877900;

DELETE FROM vendors
  WHERE id = 988877001;

COMMIT;

BEGIN;

INSERT INTO vendors (
  id,
  vendor_name,
  created_by,
  modified_by,
  created_at,
  updated_at
)
VALUES (
  988877001,
  'Inbound Journey Test Vendor',
  'fixture',
  'fixture',
  NOW(),
  NOW()
);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877101,
  988877010,
  988877001,
  'Inbound Journey Test Vendor',
  'OPEN',
  'OPEN',
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_grn_pending_audit (grn_id)
VALUES (988877101);

INSERT INTO inbound_grn_detail_snapshot (
  grn_id,
  po_id,
  vendor_id,
  po_raw,
  vendor_raw,
  grn_header_raw
)
VALUES (
  988877101,
  988877010,
  988877001,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
VALUES (
  988877101,
  0,
  'FIXTURE_SKU_INVJ',
  jsonb_build_object(
    'invoice_quantity', 10,
    'accepted_quantity', 10,
    'rejected_quantity', 0,
    'shortage_quantity', 0,
    'received_price', 100,
    'audit_price', 100,
    'tax_rate', 0
  )
);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877102,
  988877011,
  988877001,
  'Inbound Journey Test Vendor',
  'CLOSED',
  'CLOSED',
  'fixture',
  'OPEN',
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_grn_pending_invoice_collection (grn_id)
VALUES (988877102);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877103,
  988877012,
  988877001,
  'Inbound Journey Test Vendor',
  'CLOSED',
  'CLOSED',
  'fixture',
  'COLLECTED',
  'fixture',
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_grn_pending_accounts_approval (grn_id)
VALUES (988877103);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877111,
  988877014,
  988877001,
  'Inbound Journey Test Vendor',
  'OPEN',
  'OPEN',
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_grn_detail_snapshot (
  grn_id,
  po_id,
  vendor_id,
  po_raw,
  vendor_raw,
  grn_header_raw
)
VALUES (
  988877111,
  988877014,
  988877001,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO inbound_grn_invoice_files (
  grn_id,
  file_id,
  file_type,
  file_name,
  uploaded_at,
  uploaded_by,
  raw
)
VALUES (
  988877111,
  1,
  'invoice',
  'fixture-rate-diff.pdf',
  NOW(),
  'fixture',
  '{}'::jsonb
);

INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
VALUES (
  988877111,
  0,
  'FIXTURE_SKU_RATE_DIFF',
  jsonb_build_object(
    'invoice_quantity', 10,
    'accepted_quantity', 10,
    'rejected_quantity', 0,
    'shortage_quantity', 0,
    'received_price', 100,
    'audit_price', 65,
    'tax_rate', 0
  )
);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877112,
  988877015,
  988877001,
  'Inbound Journey Test Vendor',
  'OPEN',
  'OPEN',
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_grn_detail_snapshot (
  grn_id,
  po_id,
  vendor_id,
  po_raw,
  vendor_raw,
  grn_header_raw
)
VALUES (
  988877112,
  988877015,
  988877001,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO inbound_grn_invoice_files (
  grn_id,
  file_id,
  file_type,
  file_name,
  uploaded_at,
  uploaded_by,
  raw
)
VALUES (
  988877112,
  1,
  'invoice',
  'fixture-no-diff.pdf',
  NOW(),
  'fixture',
  '{}'::jsonb
);

INSERT INTO inbound_grn_items (grn_id, line_index, sku_id, raw)
VALUES (
  988877112,
  0,
  'FIXTURE_SKU_NO_DIFF',
  jsonb_build_object(
    'invoice_quantity', 10,
    'accepted_quantity', 10,
    'rejected_quantity', 0,
    'shortage_quantity', 0,
    'received_price', 100,
    'audit_price', 100,
    'tax_rate', 0
  )
);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  grn_invoice_collection_status,
  grn_invoice_collection_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  accounts_status,
  accounts_by
)
VALUES (
  988877104,
  988877013,
  988877001,
  'Inbound Journey Test Vendor',
  'CLOSED',
  'CLOSED',
  'fixture',
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  NULL,
  NULL
);

INSERT INTO inbound_pending_debit_credit_notes (
  note_id,
  grn_id,
  credit_debit_note_type,
  credit_debit_note_status,
  credit_debit_note_number,
  credit_debit_note_number_assignment_status,
  credit_debit_note_upload_status,
  po_id,
  grn_status,
  grn_audit_status,
  grn_audit_by,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_recieved,
  vendor_id,
  vendor_name,
  raw,
  synced_at
)
VALUES (
  988877501,
  988877104,
  'DEBIT_NOTE',
  'OPEN',
  NULL,
  'NOT_ASSIGNED',
  'NOT_UPLOADED',
  988877013,
  'CLOSED',
  'CLOSED',
  NULL,
  NULL,
  0,
  0,
  988877001,
  'Inbound Journey Test Vendor',
  '{}'::jsonb,
  NOW()
);

INSERT INTO inbound_grn_debit_credit_notes (
  grn_id,
  note_id,
  po_id,
  credit_debit_note_type,
  credit_debit_note_status,
  credit_debit_note_number,
  credit_debit_note_number_assignment_status,
  credit_debit_note_upload_status,
  grn_status,
  grn_audit_status,
  vendor_id,
  vendor_name,
  raw
)
VALUES (
  988877104,
  988877501,
  988877013,
  'DEBIT_NOTE',
  'OPEN',
  NULL,
  'NOT_ASSIGNED',
  'NOT_UPLOADED',
  'CLOSED',
  'CLOSED',
  988877001,
  'Inbound Journey Test Vendor',
  '{}'::jsonb
);

-- Draft GRN registration (needs PO snapshot + linkage row)

INSERT INTO inbound_po_detail_snapshot (po_id, vendor_id, vendor_raw, vendor_listings_raw, sku_names_raw, po_raw)
VALUES (
  988877900,
  988877001,
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb
);

INSERT INTO inbound_po_detail_grns (po_id, sort_index, grn_id, raw)
VALUES (
  988877900,
  0,
  -988877301,
  '{}'::jsonb
);

INSERT INTO inbound_grns (
  grn_id,
  po_id,
  vendor_id,
  vendor_name,
  grn_status,
  grn_audit_status,
  vendor_invoice_number,
  box_count_invoice,
  actual_box_count_received,
  grn_sku_count,
  grn_invoice_quantity,
  grn_accepted_quantity,
  grn_rejected_quantity,
  grn_shortage_quantity,
  po_sku_count,
  po_total_quantity,
  created_by
)
VALUES (
  -988877301,
  988877900,
  988877001,
  'Inbound Journey Test Vendor',
  'DRAFT_ZAP',
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  100,
  'fixture'
);

COMMIT;
