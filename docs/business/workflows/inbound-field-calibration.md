# Inbound field calibration

**Purpose:** For every displayed inbound field, define source of truth, writer, recompute trigger, and UI location.

---

## GRN header (`inbound_grns`)

| Field | Source of truth | Written by | Recomputed when |
|-------|-----------------|------------|-----------------|
| `grn_sku_count` | `COUNT(inbound_grn_items)` | `recalculateGrnHeaderTotals` | Line seed, line edit, close, audit, migration 071 |
| `grn_invoice_quantity` | `SUM(item invoice qty)` | Same | Same |
| `grn_accepted_quantity` | `SUM(item accepted qty)` | Same | Same |
| `grn_rejected_quantity` | `SUM(item rejected qty)` | Same | Same |
| `grn_shortage_quantity` | `SUM(item shortage qty)` | Same | Same |
| `zap_receipt_exception` | Any rejected/shortage &gt; 0 on lines | Same | Same |
| `grn_status` | Workflow | `createDraftGrnForPo`, `openDraftGrn`, `closeGrn`, sync | — |
| `grn_audit_status` | Workflow | Admin PATCH, sync | — |
| `box_count_invoice`, `actual_box_count_received` | User at GRN create | `createDraftGrnForPo` | — |
| `vendor_invoice_number` | User at GRN create | `createDraftGrnForPo` | — |

**Rule (doctrine #12):** Header quantity columns must match line items after every write. Never trust stale `0` on Zap-created GRNs.

---

## GRN lines (`inbound_grn_items.raw`)

| JSONB key | Writer | UI |
|-----------|--------|-----|
| `invoice_quantity` | Warehouse PATCH | GRN detail sheet |
| `accepted_quantity` | Warehouse PATCH | GRN detail |
| `rejected_quantity` | Warehouse PATCH | GRN detail |
| `shortage_quantity` | Warehouse PATCH | GRN detail |
| `received_price`, `audit_price` | Warehouse / admin audit | GRN detail, pending audits |

Line seed: `seedGrnItemsFromPoDetailLinesIfEmpty` — from `vendor_purchase_order_lines` (Zap PO) or `inbound_po_detail_lines` (eAutomate PO).

---

## PO header (`vendor_purchase_orders`)

| Field | Zap PO | eAutomate PO |
|-------|--------|--------------|
| `sku_count`, `total_quantity` | Canonical PO lines | Canonical + snapshot |
| `total_invoice_quantity`, fill rates | Snapshot/sync | Often from sync |
| `source` | `zap` | `eautomate` |
| `zap_status` | Cancel overlay in `po_raw` | Optional |

**Known gap:** PO summary cards (`total_received_qty`, fill rates) may not roll up from Zap GRNs until a future PO-level rollup. GRN cards on the PO page use recalibrated `inbound_grns` headers.

---

## PO detail GRN card (UI)

Reads merged bundle from `getPoDetailsBundle` → `mergePoGrnSources`:

- Quantities: `grn_sku_count`, `grn_accepted_quantity`, etc. from `inbound_grns`
- Status: `grn_status`, `grn_audit_status` from same row
- Zap-backed link: `raw.zap_origin` in `{zap, draft}`

---

## eAutomate sync vs Zap writes

| Path | Header quantities |
|------|-------------------|
| `sync-eautomate-grns.mjs` | Upserts from upstream API |
| Zap line edit | `recalculateGrnHeaderTotals` overwrites from items |
| Migration `071` | One-time backfill for existing rows |

---

## Related

- [inbound-po-grn-workflow.md](inbound-po-grn-workflow.md)
- [docs/zap-doctrine.md](../../../../docs/zap-doctrine.md)
