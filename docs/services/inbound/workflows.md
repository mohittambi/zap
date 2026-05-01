# Inbound logistics — workflows

## GRN detail page bundle

The UI at `/inbound/grns/[grnId]` loads a **bundle** from the API that typically includes:

- **header** — `inbound_grns` row
- **snapshot** — enriched detail (`inbound_grn_detail_snapshot`, timestamps, raw JSONB fragments)
- **added_items** — PO lines with pendency + listing joins
- **grn_items** — GRN line items with listing
- **invoice_files** — metadata; download via eAutomate URL or Zap Storage when `zap_storage_path` is set
- **debit_credit_notes** — per-GRN notes + files
- **grn_logs** — activity lines

**Operator-facing copy** avoids internal jargon (“ingested”, raw URL paths). **Developer mapping** of UI sections to typical eAutomate path fragments is preserved for debugging:

| UI area | Typical upstream path fragment |
|---------|-------------------------------|
| Added items (PO + pendency) | `/purchase_orders/addedItems/withListing/withPendency/` |
| GRN line items | `/purchase_orders/grn/items/withListing/` |
| Vendor invoice files | `/purchase_orders/grn/invoice_files/` |
| Debit/credit | `/purchase_orders/grn/debit_credit_notes/` |
| GRN logs | `/purchase_orders/grn/logs/{grn_id}` |

## Upload to Zap Storage

`POST /api/inbound/grns/{grnId}/upload-zap` stores files in object storage when env is configured. Success messaging stays neutral (“File uploaded”).

## Vendor PO detail snapshot — Zap fields

`inbound_po_detail_snapshot.po_raw` is filled by ingest and patched locally:

| PATCH route | Merged into `po_raw` |
|-------------|----------------------|
| `.../cancel` | `zap_status`, `zap_cancelled_at`, `zap_cancelled_by` |
| `.../modify` | `zap_notes`, `zap_modified_at`, `zap_modified_by` |

**Re-ingest** overwrites upstream JSON but **merges** the Zap keys above so cancel/notes survive sync. See `eautomatePoDetailsIngestService.ts`.

**Cancel API** is **idempotent** and **local-only** (database snapshot), not a remote eAutomate cancel.

## Pending queues (sync-driven)

- **Pending audit** — rows in `inbound_grn_pending_audit` (rebuilt on sync).
- **Pending invoice collection** — `inbound_grn_pending_invoice_collection`.
- **Pending debit/credit** — `inbound_pending_debit_credit_notes` (full replace on global sync) plus per-GRN tables when detail is ingested.

## See also

- [overview.md](overview.md)
- [../../operations/sync-runbook.md](../../operations/sync-runbook.md)
