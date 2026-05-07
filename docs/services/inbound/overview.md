# Inbound logistics — overview

**System of record:** For this deployment, **Zap** (Postgres + application APIs) is the **authoritative** place for inbound PO/GRN state, queues, uploads, and debit/credit outcomes. Treat external ERP ingest as absent unless separately documented for migration.

## Responsibility

Manage **vendor-side purchase orders**, **goods receipt notes (GRNs)**, and post-receipt workflows:

- PO listing and vendor-scoped views
- GRN creation, status updates, and **detail snapshots** (lines, invoices, debit/credit notes, logs)
- **Queues:** pending audit, pending invoice collection, pending debit/credit notes (global list)
- **Zap-side actions** on PO snapshots: cancel/modify metadata merged into `po_raw` JSONB (local DB snapshot only unless you add outbound ERP calls)

**Primary services:** `inboundGrnsService.ts`, `vendorPurchaseOrdersService.ts`, `inboundPendingDebitCreditService.ts`, `inboundPoZapActionsService.ts`, and any optional ingest modules present in your build (historic filenames may include `eautomate*`).

## Key concepts

| Concept | Meaning |
|---------|---------|
| `vendor_purchase_orders` | Inbound PO header + aggregates |
| `inbound_grns` | GRN header and workflow fields persisted in Zap |
| Detail **snapshot** tables | Cached JSONB + normalized lines for fast UI (`inbound_grn_detail_*`, `inbound_po_detail_*`) |
| **Ingest / capture** | Data enters Zap through application flows and integrations configured for **this environment** |
| **`zap_storage_path`** | Optional Supabase object path for invoice/DCN files (migration `042`) |

## Dependencies

| Internal | External |
|----------|----------|
| `vendors`, `listings` | As wired for your Zap deployment |
| `zapStorage.ts` (uploads) | Supabase Storage when configured |
| RBAC: inbound permissions from seeds `022`/`024` | — |

## Edge cases

- **PO cancel in Zap** updates **`po_raw` only** — does not call upstream cancel unless a separate integration exists.
- **Re-ingest** merges Zap-only keys (`zap_status`, notes) — see `INBOUND_PO_RAW_ZAP_MERGE_KEYS` in code.
- **GRN detail** may combine cached snapshot + live ingest depending on operator refresh.

## See also

- [Operator process notes — Inbound tab](inbound-tab-process-notes.md)
- [workflows.md](workflows.md)
- [api.md](api.md)
- [data-model.md](data-model.md)
