-- Adds accounts approval step and inventory receipt step to the GRN workflow.
-- Flow: PO → GRN → Audit → Accounts → Inventory
ALTER TABLE inbound_grns
  ADD COLUMN IF NOT EXISTS accounts_status          VARCHAR(30),
  ADD COLUMN IF NOT EXISTS accounts_by              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS accounts_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventory_receipt_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS inventory_receipt_by     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS inventory_receipt_at     TIMESTAMPTZ;

-- Queue of GRNs pending accounts team approval.
-- Repopulated on each eAutomate sync run (same pattern as inbound_grn_pending_audit).
CREATE TABLE IF NOT EXISTS inbound_grn_pending_accounts_approval (
  grn_id BIGINT PRIMARY KEY REFERENCES inbound_grns(grn_id) ON DELETE CASCADE
);
