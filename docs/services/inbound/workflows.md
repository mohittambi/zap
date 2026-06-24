# Inbound logistics — workflows

## GRN detail page bundle

The UI at `/inbound/grns/[grnId]` loads a **bundle** from the API that typically includes:

- **header** — `inbound_grns` row
- **snapshot** — enriched detail (`inbound_grn_detail_snapshot`, timestamps, raw JSONB fragments)
- **added_items** — PO lines with pendency + listing joins
- **grn_items** — GRN line items with listing
- **invoice_files** — metadata; download via Zap Storage (`zap_storage_path`) or whichever URL metadata the row carries in your deployment
- **debit_credit_notes** — per-GRN notes + files
- **grn_logs** — activity lines

**Operator-facing copy** avoids internal jargon (“ingested”, raw URL paths). Where legacy route fragments remain in payloads, developer mapping **example** fragments for debugging only:

| UI area | Typical upstream path fragment |
|---------|-------------------------------|
| Added items (PO + pendency) | `/purchase_orders/addedItems/withListing/withPendency/` |
| GRN line items | `/purchase_orders/grn/items/withListing/` |
| Vendor invoice files | `/purchase_orders/grn/invoice_files/` |
| Debit/credit | `/purchase_orders/grn/debit_credit_notes/` |
| GRN logs | `/purchase_orders/grn/logs/{grn_id}` |

## Upload to Zap Storage

`POST /api/inbound/grns/{grnId}/upload-zap` stores files in object storage when env is configured. Success messaging stays neutral (“File uploaded”).

## GRN close and Zap rate-diff debit note

After a successful **`POST /api/inbound/grns/{grnId}/close`** (vendor invoice already on file), the server **best-effort** runs the same eligibility check as `POST …/debit-note`: if any accepted line has vendor `received_price` above `audit_price`, a **`DRAFT`** row is created in `inbound_zap_debit_notes`. The same auto-generation runs when an **admin** marks audit closed via **`PATCH …/grn_audit_status`** to a terminal value. If there is no discrepancy, terminal note state, or validation skip, the close/audit response is unchanged. See [inbound-grn-debit-credit-note-flows.md](../../inbound-grn-debit-credit-note-flows.md) §1–2.

**Accounts sequence when a Zap DN exists:** assign **`dn_number`** via **`PATCH …/debit-note`**; download combined invoice + DN via **`GET …/invoice-export`** (DN sheets populated when a note exists); complete the cycle with **`POST …/debit-note/cn-copy`** (→ **`CLOSED`**) unless using the documented **`PATCH …/debit-note`** `{ "close": true }` path without CN. Details in [inbound-grn-debit-credit-note-flows.md](../../inbound-grn-debit-credit-note-flows.md) §2 “Accounts Team — Zap DN”.

## Vendor PO detail snapshot — Zap fields

`inbound_po_detail_snapshot.po_raw` is filled by ingest and patched locally:

| PATCH route | Merged into `po_raw` |
|-------------|----------------------|
| `.../cancel` | `zap_status`, `zap_cancelled_at`, `zap_cancelled_by` |
| `.../modify` | `zap_notes`, `zap_modified_at`, `zap_modified_by` |

**Re-ingest** overwrites upstream JSON but **merges** the Zap keys above so cancel/notes survive sync. See `eautomatePoDetailsIngestService.ts`.

**Cancel API** is **idempotent** and **local-only** (database snapshot), without implying outbound ERP writes unless wired separately.

## Pending queues (Zap-maintained)

- **Pending audit** — rows in `inbound_grn_pending_audit` joined to `inbound_grns` (Zap DB is the source of truth for list membership as defined by this app). **Mark Audited** requires the **`admin` role**; the web UI shows a **Confirm Audit** dialog first. List response includes `grn_audit_price_total` (admin-only column in UI). After audit is closed, GRN line `PATCH` is rejected (**409**, log `AUDIT_LOCKED`). See [../../current-system/workflows.md](../../current-system/workflows.md) § Pending audits.
- **Pending invoice collection** — `inbound_grn_pending_invoice_collection` (operator language: *pending physical invoice copy*). After Accounts marks **`COLLECTED`** on `grn_invoice_collection_status`, **`GET /api/inbound/grns/{grnId}/invoice-export`** (and **Download Invoice Excel** on the web GRN Accounts tab) supplies the invoice workbook **on demand**; the mark-received action does not auto-generate or store a file. See [inbound-grn-debit-credit-note-flows.md](../../inbound-grn-debit-credit-note-flows.md) §1 Accounts subsection.
- **Pending debit/credit** — `inbound_pending_debit_credit_notes` plus per-GRN `inbound_grn_debit_credit_notes` (see flows doc §3); lifecycle is owned in Zap.

## See also

- [overview.md](overview.md)
- [Inbound journey (canonical hub)](../inbound-journey.md)
- [Operator process notes — Inbound tab](inbound-tab-process-notes.md)
- [Inbound journey — API & test matrix](../inbound-journey-api-test-matrix.md)
- [../../operations/sync-runbook.md](../../operations/sync-runbook.md)
