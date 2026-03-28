-- GRNs from eautomate POST .../grn/pending_for_invoice_collection/paginated
-- Repopulated on each sync-eautomate-grns-pending-invoice-collection run.

CREATE TABLE IF NOT EXISTS inbound_grn_pending_invoice_collection (
    grn_id BIGINT PRIMARY KEY REFERENCES inbound_grns(grn_id) ON DELETE CASCADE
);
