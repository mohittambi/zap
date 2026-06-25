# Inbound activity log

GRN and PO workflow events are recorded in `inbound_grn_logs` (and PO cancel metadata in `inbound_po_detail_snapshot.po_raw`).

---

## `inbound_grn_logs.log_type` catalog

| log_type | When written | Typical `operation_performed` |
|----------|--------------|-------------------------------|
| `STATUS` | GRN created, draft opened, workflow PATCH | "GRN draft created in zap", status field updates |
| `GRN` | GRN closed | "GRN closed" |
| `LINE` | Line item PATCH | Quantity/price edit summary |
| `AUDIT` | Admin marks audit closed | "GRN marked as audited by admin" |
| `AUDIT_DENIED` | Non-admin audit attempt | Access denied |
| `AUDIT_LOCKED` | Line edit after audit | "Line edit blocked — GRN audit is closed" |
| `DOCUMENT` | Invoice or file upload | File name / path |
| `DEBIT_NOTE` | DN generate, assign number, CN copy | Debit note actions |
| `ACCOUNTS_DENIED` | Non-admin accounts action | Access denied |

Logs are append-only; failures to write are non-blocking (`appendInboundGrnLogSafe`).

---

## PO-level events (snapshot `po_raw`)

| Field | When |
|-------|------|
| `zap_status: CANCELLED` | PO cancel confirmed |
| `zap_cancelled_at`, `zap_cancelled_by` | Same |
| `zap_notes`, `zap_modified_at` | Modify PO notes |

Cancel blocked by API returns `409` with a business message (not always logged to GRN logs).

---

## UI

GRN detail → **Activity** tab lists `inbound_grn_logs` for the GRN.

---

## Related

- [inbound-po-grn-workflow.md](inbound-po-grn-workflow.md)
