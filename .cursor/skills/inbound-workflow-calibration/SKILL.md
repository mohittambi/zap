---
name: inbound-workflow-calibration
description: Maintains Zap inbound PO, GRN, audit, accounts, and eAutomate-sync workflow correctness. Use when editing inbound purchase orders, GRNs, queues, reports, status transitions, field totals, Zap-created vs eAutomate-synced records, or business documentation for inbound operations.
---

# Inbound Workflow Calibration

## Core rules

1. Zap DB is canonical for UI reads — no eAutomate calls from API request paths.
2. Respect `source`: `zap` vs `eautomate`; Zap IDs use `ZP-` / `ZG-` prefixes (doctrine #5).
3. GRN header quantity fields must be derived from `inbound_grn_items` via `recalculateGrnHeaderTotals` (doctrine #12).
4. Any route that changes line quantities must call the recalc helper in the same transaction when possible.
5. PO cancel is blocked after receipt starts (`assertPoCancellable` / `poCancelBlockReason`).
6. Modify PO is notes-only (`zap_notes`) — do not lock unless scope expands beyond notes.
7. Audit close locks line edits; destructive actions need UI confirmation + server validation.
8. Reports/exports use canonical tables (doctrine #11).

## Required checks before editing

- Identify Zap-created vs eAutomate-synced journey.
- List fields read/written and their source of truth.
- Touch affected screens: PO detail, GRN detail, pending queues, reports.
- Add/update unit tests for recalc, cancel guard, and migration parity.
- Update business docs if workflow behavior changes.

## Key files

| Area | Path |
|------|------|
| Recalc service | `src/server/services/grnHeaderTotalsService.ts` |
| Quantity keys | `src/lib/inboundGrnQuantities.ts` |
| PO cancel guard | `src/lib/inboundPoCancelGuard.ts`, `assertPoCancellable` in `inboundPoZapActionsService.ts` |
| GRN service | `src/server/services/inboundGrnsService.ts` |
| PO bundle | `src/server/services/eautomatePoDetailsIngestService.ts` |

## Documentation

- `docs/business/workflows/inbound-po-grn-workflow.md`
- `docs/business/workflows/inbound-field-calibration.md`
- `docs/business/workflows/inbound-activity-log.md`
- `docs/inbound-journey.md`
- `docs/zap-doctrine.md` (rules #10–#12)

## Verification

```bash
cd web
npm run verify:migrations
npm run test:unit
npm run build
```

When adding migrations: append to `scripts/run_migrations.sh`, run `npm run migrate`.
