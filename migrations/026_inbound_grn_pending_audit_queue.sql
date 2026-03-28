-- GRNs currently returned by eautomate POST .../grn/pending_for_audit/paginated
-- Repopulated on each sync-eautomate-grns-pending-audit run (truncate + insert).

CREATE TABLE IF NOT EXISTS inbound_grn_pending_audit (
    grn_id BIGINT PRIMARY KEY REFERENCES inbound_grns(grn_id) ON DELETE CASCADE
);
