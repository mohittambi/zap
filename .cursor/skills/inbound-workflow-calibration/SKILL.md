---
name: inbound-workflow-calibration
description: Maintains Zap inbound PO, GRN, audit, accounts, and eAutomate-sync workflow correctness. Use when editing inbound purchase orders, GRNs, PO summary totals, fill rates, queues, reports, status transitions, field totals, Zap-created vs eAutomate-synced records, migrations 071/072, or business documentation for inbound operations.
---

# Inbound Workflow Calibration

**Read this skill** before changing inbound PO/GRN totals, cancel guards, sync scripts, or PO detail UI. Canonical doctrine: [`docs/zap-doctrine.md`](../../../../docs/zap-doctrine.md) rules **#10–#13**.

---

## Data calibration stack (single source of truth)

Three denormalized layers — each derived from the layer below. Never show stale `0` on Zap records when lines have data.

```
inbound_grn_items.raw          ← canonical (warehouse PATCH)
        ↓ recalculateGrnHeaderTotals
inbound_grns.grn_*             ← GRN cards on PO detail, queues, reports
        ↓ recalculatePoHeaderTotals (source='zap' only)
vendor_purchase_orders.total_* ← PO summary cards (received, fill rates)
```

**Visual flow for operators:** `/flows` → **GRN Totals & PO Calibration** and **PO Cancel Guard**.

**Orchestrator:** always prefer `recalculateGrnAndPoHeaderTotals(grnId, client?)` after any GRN line write — it runs GRN recalc then PO recalc for the parent PO.

---

## Core rules

1. Zap DB is canonical for UI reads — no eAutomate calls from API request paths (doctrine #1).
2. Respect `source`: `zap` vs `eautomate`; Zap IDs use `ZP-` / `ZG-` prefixes (doctrine #5).
3. GRN header quantity fields must be derived from `inbound_grn_items` via `recalculateGrnHeaderTotals` (doctrine #12).
4. PO summary totals on `vendor_purchase_orders` (`number_of_grns`, `total_invoice_quantity`, `total_accepted_quantity`, `total_rejected_quantity`, `sku_fill_rate`, `quantity_fill_rate`) must roll up from `inbound_grns` via `recalculatePoHeaderTotals` for **`source='zap'` only** (doctrine #13). eAutomate PO totals stay on sync.
5. Any route that changes line quantities must call `recalculateGrnAndPoHeaderTotals` in the **same transaction** when a `PoolClient` is available.
6. Per-line quantity conservation: `invoice_quantity = accepted + rejected + shortage` (`grnLineQuantitySumErrorMessage` in `src/lib/grnLineQuantityValidation.ts`).
7. PO cancel is blocked after receipt starts (`assertPoCancellable` / `poCancelBlockReason`) — API **409**, UI disabled + tooltip.
8. Modify PO is **notes-only** (`zap_notes`) — does not change SKU lines or quantities.
9. Audit close locks line edits; destructive actions need `AlertDialog` confirmation + server validation. **`audit_price`** is set only in **Pending Audit → Confirm Audit** (defaults to vendor `received_price`). `PATCH …/items/{lineIndex}` accepts **partial bodies** (`mergeGrnItemPatchIntoRaw` merges into existing `raw`; audit-only `{ audit_price }` is valid).
10. Reports/exports use canonical tables (doctrine #11) — not snapshot-only queries for Zap POs.
11. eAutomate sync must not overwrite Zap rollups — PO list UPSERT in `sync-eautomate-vendor-pos.mjs` scoped to `WHERE vendor_purchase_orders.source = 'eautomate'` (doctrine #10).
12. **PO header sync ≠ PO detail sync** — `sync:vendor-pos*` only upserts `vendor_purchase_orders` (headers). SKU lines, listings, and GRN snapshot for eAutomate POs require `sync:po:details*` (`inbound_po_detail_snapshot`, `inbound_po_detail_lines`). After vendor-pos, always run `sync:po:details:missing` or `sync:po:details:if-needed -- --po <id>`. Missing = no snapshot **or** `sku_count > 0` with zero `inbound_po_detail_lines`.
13. Update `/flows`, business workflow docs, and this skill when calibration or guard behavior changes.

---

## Fill-rate definitions (match eAutomate)

Stored as **0–100 percentages** (`NUMERIC(10,2)`), consumed by `FillRateBar` on PO list/detail.

| Field | Formula (Zap PO rollup) |
|-------|-------------------------|
| `quantity_fill_rate` | `total_accepted_quantity ÷ total_quantity × 100` |
| `sku_fill_rate` | distinct SKUs with any `accepted_quantity > 0` on GRN lines ÷ `sku_count × 100` |

Pure helpers: `computePoHeaderTotalsFromGrns`, `roundFillRatePct` in `src/lib/inboundPoHeaderTotals.ts`.

---

## PO cancel guard

`poCancelBlockReason(grns)` returns a block reason when **any** linked GRN has:

- `grn_status` OPEN or CLOSED (receipt started)
- `grn_audit_status` closed/audited
- invoice collection or accounts progressed
- any recorded invoice/accepted/rejected/shortage quantity on the GRN header

Enforced in `assertPoCancellable` (API) and `canCancelPo` (PO detail UI).

---

## Confirmation matrix (terminal actions)

| Action | UI | API guard |
|--------|-----|-----------|
| Close GRN | `AlertDialog` on GRN detail | Invoice file required; status must be OPEN |
| Close audit | Confirm dialog (admin) | Lines locked after audit |
| Accounts approve/reject | Confirm (admin) | Queue transition |
| Cancel PO | Confirm + disabled when blocked | `assertPoCancellable` → 409 |
| Debit note force regenerate | `AlertDialog` on GRN detail | Server validation |
| Register operational GRN id | `AlertDialog` on GRN detail | DRAFT_ZAP only |

Do **not** use `window.confirm` for new inbound flows.

---

## Wire points (must call `recalculateGrnAndPoHeaderTotals`)

In `src/server/services/inboundGrnsService.ts`:

- `updateInboundGrnItemRaw` (transactional)
- `updateGrnStatus` / audit path
- `closeGrn`
- `createDraftGrnForPo` (after seed)
- `registerOperationalGrnId`
- `openDraftGrn`

In `src/server/services/grnDebitNoteService.ts`:

- `seedGrnItemsFromPoDetailLinesIfEmpty` (transactional)

---

## Migrations

| Migration | Purpose |
|-----------|---------|
| `071_recalculate_grn_header_totals.sql` | Backfill GRN header aggregates from `inbound_grn_items` |
| `072_recalculate_po_header_totals.sql` | Backfill Zap PO summary cards from `inbound_grns` |

Registry: append to `scripts/run_migrations.sh`; `npm run verify:migrations` must pass.

---

## Key files

| Area | Path |
|------|------|
| GRN + PO orchestrator | `src/server/services/grnHeaderTotalsService.ts` |
| PO rollup SQL | `src/server/services/poHeaderTotalsService.ts` |
| PO rollup pure math | `src/lib/inboundPoHeaderTotals.ts` |
| GRN quantity keys | `src/lib/inboundGrnQuantities.ts` |
| GRN line PATCH merge | `src/lib/inboundGrnItemPatch.ts` (`mergeGrnItemPatchIntoRaw` — partial body, audit-only OK) |
| PO cancel guard | `src/lib/inboundPoCancelGuard.ts`, `assertPoCancellable` in `inboundPoZapActionsService.ts` |
| GRN lifecycle | `src/server/services/inboundGrnsService.ts` |
| PO bundle | `src/server/services/eautomatePoDetailsIngestService.ts` |
| PO detail ingest guard | `poDetailsIngestNeededFromCounts`, `listPoIdsNeedingDetailIngest` |
| PO sync guard | `scripts/sync-eautomate-vendor-pos.mjs` |
| PO detail sync | `scripts/sync-eautomate-po-details.ts`, `scripts/sync-eautomate-po-details-if-needed.ts` |
| PO detail UI | `src/app/(app)/(logistics)/inbound/vendors/[id]/purchase-orders/[poId]/page.tsx` |
| Open New GRN modal helpers | `src/lib/inboundNewGrnModal.ts` |
| Business flow UI | `src/app/(app)/flows/page.tsx` |

---

## UI read sites

| Screen | Reads |
|--------|-------|
| PO detail summary cards | `bundle.header.total_*`, `sku_fill_rate`, `quantity_fill_rate` from `vendor_purchase_orders` |
| PO detail GRN cards | `inbound_grns.grn_*` via `mergePoGrnSources` |
| PO / vendor PO lists | Same header columns on list rows |
| GRN detail | Line items from `inbound_grn_items`; header from `inbound_grns` |
| Open New GRN modal | Read-only PO context + seeded-line preview from `bundle`; invoice # stays blank; actual boxes mirror invoice boxes until user edits actual field |

---

## Documentation (keep in sync)

- `docs/business/workflows/inbound-po-grn-workflow.md` — steps, confirmations, calibration narrative
- `docs/business/workflows/inbound-field-calibration.md` — field-by-field source of truth
- `docs/business/workflows/inbound-activity-log.md` — `inbound_grn_logs.log_type` catalog
- `docs/inbound-journey.md` — engineer hub
- `docs/inbound-journey-api-test-matrix.md` — API test map
- `docs/business/modules/inbound.md` — business owner overview
- `docs/deployment/migrations.md` — migration registry
- `docs/zap-doctrine.md` — rules #10–#13

---

## Test bar (required on behavior change)

| Suite | File |
|-------|------|
| GRN header rollup | `tests/unit/grn-header-totals.test.ts` |
| PO header rollup | `tests/unit/po-header-totals.test.ts` |
| Open New GRN modal | `tests/unit/inbound-new-grn-modal.test.ts` |
| PO cancel guard | `tests/unit/inbound-po-cancel-guard.test.ts` |
| GRN line PATCH merge | `tests/unit/inbound-grn-item-patch.test.ts` |
| Migration parity | `tests/unit/migrations-parity.test.mjs` (latest = `072`) |
| API integration | `tests/api/inbound-journey-integration.test.mjs` (PO rollup header + cancel 409) |

```bash
cd web
npm run verify:migrations
npm run test:unit
npm run build
```

When adding migrations: append to `scripts/run_migrations.sh`, run `npm run migrate`.
