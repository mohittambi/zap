# Inbound logistics — data model

Authoritative DDL: `web/migrations/023`–`033` and related. Human-readable catalogue: [../../architecture/database-schema.md](../../architecture/database-schema.md).

## Core tables

| Table | Role |
|-------|------|
| `vendor_purchase_orders` | Inbound PO header (`po_id` PK, `vendor_id`, aggregates, status) |
| `vendor_purchase_order_lines` | PO lines: SKU, quantity |
| `inbound_grns` | GRN header (`grn_id` PK, `po_id`, `vendor_id`, quantities, statuses) |
| `inbound_grn_pending_audit` | Queue: GRNs awaiting audit (rebuilt on sync) |
| `inbound_grn_pending_invoice_collection` | Queue: invoice collection |
| `inbound_grn_detail_snapshot` | One row per GRN: vendor/PO display fields, `po_raw`/`grn_header_raw`, `grn_api_raw`, `synced_at` |
| `inbound_grn_invoice_files` | Invoice file metadata + `download_url` + `raw`; **`zap_storage_path`** (`042`) |
| `inbound_grn_added_items` / `inbound_grn_items` | Line-level rows with `raw` JSONB |
| `inbound_grn_debit_credit_notes` + `_files` | Per-GRN DCN headers and files |
| `inbound_grn_logs` | Activity log lines |
| `inbound_pending_debit_credit_notes` | Global pending list; full replace on sync |
| `inbound_po_detail_snapshot` | One row per PO: `po_raw`, `vendor_raw`, listing caches |
| `inbound_po_detail_lines` | Normalized PO lines `(po_id, line_index)` |
| `inbound_po_detail_grns` | GRN refs on PO detail `(po_id, sort_index)` |

## JSONB: `po_raw` Zap merge keys

On re-ingest, these keys are preserved from the existing row when merging upstream PO JSON:

- From cancel: `zap_status`, `zap_cancelled_at`, `zap_cancelled_by`
- From modify: `zap_notes`, `zap_modified_at`, `zap_modified_by`

Constant: `INBOUND_PO_RAW_ZAP_MERGE_KEYS` in `eautomatePoDetailsIngestService.ts`.

## See also

- [workflows.md](workflows.md) — cancel/modify behavior
- [../../architecture/database-schema.md](../../architecture/database-schema.md)
