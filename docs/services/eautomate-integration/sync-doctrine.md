# eAutomate sync doctrine — one-way ingest

**Read this before debugging “sync didn’t update eAutomate” or “Packed Quantity still 0 after Save lines”.**

## Core rule

**All `npm run sync:*` scripts are inbound only: eAutomate → Zap Postgres.**

Running sync **does not write back** to eAutomate. Saving in the Zap UI **does not update eAutomate** for most outbound workflow steps unless a route explicitly documents an upstream POST (rare).

| Direction | Happens? |
| --------- | -------- |
| eAutomate → Zap (sync scripts) | **Yes** |
| Zap → eAutomate (after sync or UI save) | **No** (default) |
| Zap UI reads eAutomate inline | **No** — UI reads Postgres only |

See also: [../../current-system/workflows.md](../../current-system/workflows.md) (boundary rule), [../../operations/sync-runbook.md](../../operations/sync-runbook.md).

---

## What sync updates (Zap DB only)

| Script / phase | Writes to Postgres | Updates eAutomate? |
| -------------- | ------------------ | ------------------ |
| `sync:outbound-partial-pos` | PO headers, partial listings | No |
| `sync:outbound-po-detail` | PO detail, files metadata, listings snapshot | No |
| `sync:outbound-consignments` | Consignment list, delivery locations | No |
| `sync:outbound-consignment-items --skip-consignments` | Box names, transporters | No |
| `sync:outbound-consignment-items` (full) | Consignment items, `detail_raw` — **replaces** rows from eAutomate listings | No |
| Inbound PO/GRN detail sync | Snapshots, lines, queues | No |

**eAutomate stays unchanged.** Operators may still see old data in eAutomate UI after a successful Zap sync.

---

## What Zap UI writes (Zap DB only)

These actions persist in **Zap Postgres** and do **not** push packing / RTD / invoice state to eAutomate:

| Zap action | Stored in | eAutomate updated? |
| ---------- | --------- | ------------------ |
| **Save lines** (consignment packing CSV / editor) | `outbound_consignment_items`, consignment aggregates; PO `listings_snapshot` packed rollup | **No** |
| **Mark for dispatch (RTD)** | `outbound_consignments`, logs | **No** |
| **Create consignment** (Zap-native id `9000000000000+`) | `outbound_consignments` | **No** |
| PO **attachments** / spreadsheet upload | Zap storage + `listings_snapshot` (Zap path) | No |
| Invoice upload on consignment | Zap storage + consignment row | No |

Confirm success in **Zap** (toast, Consignment Summary, Consignment Logs) — not by checking eAutomate.

---

## Common misconceptions (outbound packing)

### “Save lines succeeded but PO Packed Quantity is still 0”

- **Bottom PO line items table** on consignment detail uses `GET …/po-listings`, which merges Zap PO `listings_snapshot` with **this consignment’s** packed qty from `outbound_consignment_items`.
- After **Save lines**, bottom Packed Quantity should match the top editor (refresh without reload). If it does not, check the merge API — not eAutomate sync.
- **Save lines** also rolls packed totals into the PO `listings_snapshot` for the PO detail page (all consignments on that PO). Neither step updates eAutomate.

### “We ran sync — why doesn’t eAutomate show our boxes?”

Sync never pushes box assignments to eAutomate. Box names sync **into** `outbound_valid_box_names` for validation only.

### “Re-sync will fix our Zap packing”

**Danger:** full `sync:outbound-consignment-items` **deletes and replaces** `outbound_consignment_items` from eAutomate listings. It can **wipe Zap-saved packing**. Use `--skip-consignments` for master data only unless intentionally refreshing from eAutomate.

---

## Source of truth by concern

| Concern | Source of truth in operations |
| ------- | ------------------------------ |
| Vendor / inbound PO / GRN master (synced) | eAutomate copy in Zap until Zap-local overrides |
| Outbound PO listings (synced) | eAutomate `listings_snapshot` in Zap |
| **Consignment packing entered in Zap** | **Zap** (`outbound_consignment_items`, editor state) |
| Valid box types for Save lines | eAutomate → `outbound_valid_box_names` (via sync) |
| Mark RTD, docket, transporter on consignment | **Zap** |
| PO logs written from Zap actions | **Zap** (`outbound_po_logs`, `source: zap`) |

When triaging client reports, ask: **“Are they looking at Zap or eAutomate?”**

---

## Prod ops checklist

1. **Sync fixes stale Zap data from eAutomate** — not the reverse.
2. **Use `.env.production.local`** for prod DB; `.env.local` is often dev.
3. After migration, run **`sync:outbound-consignment-items -- --skip-consignments`** on prod once (box names + transporters).
4. Do **not** expect eAutomate to reflect Zap packing without a separate upstream integration (not implemented for standard outbound save).
5. **Incremental drift:** eAutomate changes after last sync (Jun 2026 migration baseline) require **`sync:outbound-partial-pos`**, **`sync:outbound-consignments`**, or per-PO **`sync:outbound-po-detail`** — still inbound only.

---

## See also

- [sync-flows.md](sync-flows.md) — script map
- [../outbound/outbound-tab-process-notes.md](../outbound/outbound-tab-process-notes.md) — operator workflow
- [../../operations/prod-supabase-migration-sync-warnings.md](../../operations/prod-supabase-migration-sync-warnings.md) — migration gaps
