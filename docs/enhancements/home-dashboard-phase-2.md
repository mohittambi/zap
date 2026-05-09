# Home Dashboard — Phase 2 Plan

## Context

Phase 1 ([planning-to-create-a-polymorphic-phoenix.md](../../../../.claude/plans/planning-to-create-a-polymorphic-phoenix.md)) shipped the operations home page at `/` with 5 KPI cards (sales qty, sales POs, fill rate, inbound qty, SKUs below reorder), 2 trend charts (sales + inbound, 90 days, prior-year overlay), a reorder-alerts strip, and a saved-query panel. Inbound is shown across all vendors regardless of company filter; outbound is correctly company-scoped via a `(company_id = $X OR company_name = $Y)` filter (production data has `company_id = NULL` on every consignment).

Phase 2 widens the surface to answer the questions an ops owner asks every morning that Phase 1 doesn't yet cover: *"What's pending in our queues? Are we shipping on time? How clean is our inbound? Where is the channel mix going? Are we out of stock anywhere?"* It is purely additive — no change to existing cards or routes.

## Data reality check (verified 2026-05-08)

Every Phase 2 KPI below is grounded in a count run against the live DB. Tables that look promising but are empty are explicitly **not** used.

| Table | Rows | Phase 2 use |
|---|---|---|
| `bins` (active) | 5,956 (1.17M units) | ✅ Inventory on hand, stockout SKUs |
| `outbound_purchase_orders` | 4,185 | ✅ Open POs, aged POs, on-time fulfillment |
| `outbound_consignments` + `outbound_consignment_items` | 3,537 / 58,488 | ✅ Top companies (qty via `total_quantity`) |
| `inbound_grns` | 826 | ✅ Acceptance / shortage / rejection rate |
| `inbound_grn_pending_audit` | 2 | ✅ Ops queue card |
| `inbound_grn_pending_invoice_collection` | 2 | ✅ Ops queue card |
| `inbound_pending_debit_credit_notes` | 197 | ✅ Ops queue card |
| `sku_analytics` | **0** | ❌ Skip — backed by upstream sync that hasn't run |
| `warehouse_inventory_dump` | **5** | ❌ Skip — sales-velocity stockout not viable |
| `incoming_quantity` | **0** | ❌ Skip — "expected inbound" defer to Phase 3 |
| `outbound_consignment_items.consignment_quantity` / `overall_fill_rate` | NULL on all 58k rows | ❌ Already known; not in Phase 2 scope |

## Phase 2 scope — 5 additions

Listed in priority order. Each is independent and could ship separately.

### 1. Operational queues card

A single Card with three counts, click-through links to the respective module pages.

| Sub-metric | Source | Aggregation |
|---|---|---|
| GRN audit pending | `inbound_grn_pending_audit` | `COUNT(*)` |
| Invoice collection pending | `inbound_grn_pending_invoice_collection` | `COUNT(*)` |
| Debit/credit notes pending | `inbound_pending_debit_credit_notes` | `COUNT(*) FILTER (WHERE credit_debit_note_status NOT IN ('CLOSED','RESOLVED'))` |

- **No MoM/YoY** — these are live queue depths, point-in-time.
- Each count is a small badge with a `→` link. Cancelled/closed status filter must be tightened against the real status enum after a quick `SELECT DISTINCT credit_debit_note_status …` once.
- Permission: same `bins:read` as the rest of `/api/home/summary`.

### 2. Open sales POs + aging card

Two-stat KPI card.

| Sub-metric | SQL |
|---|---|
| Open POs | `COUNT(*) FROM outbound_purchase_orders WHERE calculated_po_status IN ('OPEN', 'ACKNOWLEDGEMENT PENDING')` |
| Aged > 7 days | `… AND po_issue_date < NOW() - INTERVAL '7 days'` |

- Filterable by company via the existing `(company_id = $X OR company_name = $Y)` pattern.
- **No MoM/YoY** — point-in-time backlog.
- Status enum verified from the live DB: `EXPIRED` (3,057), `ACKNOWLEDGEMENT PENDING` (833), `OPEN` (97), `MARKED CANCELLED` (188).

### 3. Vendor quality KPI card (GRN ratios, 30 days)

Two percentages on one card, weighted by qty.

| Sub-metric | SQL (30-day window) |
|---|---|
| Acceptance rate | `SUM(grn_accepted_quantity) / NULLIF(SUM(grn_invoice_quantity), 0)` |
| Shortage rate | `SUM(grn_shortage_quantity) / NULLIF(SUM(grn_invoice_quantity), 0)` |

- Reuses the existing trailing-30-day window from `homeSummaryService.buildWindows`.
- **MoM/YoY:** apply existing `computeDelta` to the acceptance rate (a higher number is better → green when up). Shortage uses inverted color (green when down).
- Live data confirms ratios are well-defined: invoiced 9,460 / accepted 9,435 / rejected 14 / shortage 11.
- Vendor-keyed so **not company-scoped** — same caveat as inbound qty card.

### 4. Channel mix mini-chart (top 5 companies, 30d)

Horizontal bar chart inside a Card. Replaces no existing element; sits between the trend charts row and the reorder alerts strip.

```sql
SELECT COALESCE(c.name, oc.company_name) AS company,
       SUM(oc.total_quantity)::bigint AS qty
FROM   outbound_consignments oc
LEFT   JOIN companies c ON c.id = oc.company_id OR c.name = oc.company_name
WHERE  oc.marked_rtd_at >= $start::timestamptz
  AND  oc.marked_rtd_at < $end::timestamptz
GROUP  BY 1
ORDER  BY qty DESC
LIMIT  5
```

- Hidden when a company filter is active (the chart's purpose is mix breakdown — not useful with a single channel selected).
- **No MoM/YoY** — chart shows the absolute trailing-30 mix; the trend chart already covers time-comparisons.

### 5. Inventory snapshot card (point-in-time)

One Card, two big stats.

| Sub-metric | SQL |
|---|---|
| Units on hand | `SUM(available_quantity) FROM bins WHERE is_deleted = false` |
| SKUs at zero stock | `COUNT(*) FROM listings l LEFT JOIN bins b ON b.sku_id = l.sku_id AND b.is_deleted = false GROUP BY l.sku_id HAVING COALESCE(SUM(b.available_quantity), 0) = 0` |

- **No MoM/YoY** — these are live counts, no history snapshotted.
- **Not company-scopable** — bins are not customer-attributed. When a company is selected, render with a small "(across catalogue)" hint. Same pattern already used for inbound.
- Note: a richer "stockout with demand" KPI is **out of scope for Phase 2** — `sku_analytics.outward_30d` is empty and `warehouse_inventory_dump` SALE movements are 5 rows total. Defer until upstream sync populates these.

## Page layout after Phase 2

```
AppPageShell
  AppPageTitle "Operations overview" + IST date range subtitle
  HomeFilters                   // unchanged
  KpiCardsRow                   // 5 cards, unchanged
  PhaseTwoOpsRow                // NEW: 4 cards in a grid (md:grid-cols-2 lg:grid-cols-4)
    OpsQueuesCard               //   #1
    OpenPosCard                 //   #2
    VendorQualityCard           //   #3
    InventorySnapshotCard       //   #5
  TrendChartsRow                // unchanged
  ChannelMixCard                // NEW: #4 — full-width, hidden under company filter
  ReorderAlertsStrip            // unchanged
  SavedQueryPanel               // unchanged
```

## API changes

One consolidated endpoint stays the rule. Extend the existing `GET /api/home/summary` response — do not add a second endpoint.

```ts
// Additions to HomeSummary in homeSummaryService.ts
export type OpsQueues = {
  audit_pending: number;
  invoice_collection_pending: number;
  debit_credit_notes_pending: number;
};

export type OpenPosStat = { open: number; aged_over_7d: number };

export type VendorQuality = {
  acceptance_rate_pct: Delta;   // weighted by invoice qty, MoM/YoY
  shortage_rate_pct: Delta;
};

export type InventorySnapshot = { units_on_hand: number; skus_at_zero: number };

export type ChannelMixRow = { company: string; qty: number };

// ⬇ added top-level keys
export type HomeSummary = {
  // ...existing fields...
  ops_queues: OpsQueues;
  open_pos: OpenPosStat;
  vendor_quality: VendorQuality;
  inventory_snapshot: InventorySnapshot;
  channel_mix: ChannelMixRow[] | null;   // null when company filter is active
};
```

All new aggregations issued through `Promise.all` alongside the existing ones — single round trip, indexed columns, expected to add <100ms in p50. Same `requireAuth` + `assertPermission(user, "bins", "read")` gate.

## File changes

**New (each ~50-90 LoC, mirroring existing component shape):**

- `src/components/home/ops-queues-card.tsx`
- `src/components/home/open-pos-card.tsx`
- `src/components/home/vendor-quality-card.tsx`
- `src/components/home/inventory-snapshot-card.tsx`
- `src/components/home/channel-mix-card.tsx`
- `src/components/home/phase-two-ops-row.tsx` (composes the four cards)

**Modified:**

- [`src/server/services/homeSummaryService.ts`](../../src/server/services/homeSummaryService.ts) — add the 5 aggregation builders + extend the `Promise.all` and the response shape. Reuse existing `buildWindows`, `computeDelta`, `asDelta`, `buildCompanyFilter`, `lookupCompanyName`.
- [`src/components/home/home-content.tsx`](../../src/components/home/home-content.tsx) — drop in the new row + `ChannelMixCard`.
- [`src/hooks/use-home-summary.ts`](../../src/hooks/use-home-summary.ts) — no shape changes, the hook just re-types via `HomeSummary`.

**Reused (do not duplicate):**

- `Card` family from `src/components/ui/card.tsx`
- `Skeleton` for loading states
- `formatIstDate` / `formatIstShortDay` from `src/lib/format-ist.ts`
- `KpiCard`'s delta-badge pattern for the vendor-quality % deltas
- Recharts `BarChart` (already used in `saved-query-result.tsx`)

## Verification plan

1. **DB sanity** — before coding, confirm queue tables / status enums have not drifted:
   ```bash
   psql … -c "SELECT DISTINCT credit_debit_note_status FROM inbound_pending_debit_credit_notes"
   psql … -c "SELECT DISTINCT calculated_po_status FROM outbound_purchase_orders"
   ```
2. **Service-level** — extend `web/scripts/_home-debug.ts` (or its successor) to print the 5 new keys; expected initial values: ops_queues `{2, 2, ~all-open}`, open_pos `{97, 97}`, vendor_quality `{99.7%, 0.1%}`, inventory_snapshot `{1,171,449, ?}`, channel_mix top entry should be Amazon Etrade or Blinkit.
3. **Hand-compute one of each** in `psql` and compare to the JSON response (same approach used in Phase 1).
4. **UI** — log into dev, refresh `/`, confirm the 4-card row + channel-mix bar chart render with real values; toggle company filter and confirm `channel_mix` becomes `null` and the card is hidden.
5. **Auth** — `/api/home/summary` without auth → 401; with `bins:read` revoked → 403 (already covered by the existing route).
6. **Unit test** — extend `tests/unit/home-summary-deltas.test.ts` only if vendor-quality delta inversion needs verifying; otherwise the existing 6 cases cover all delta math.

## Out of scope (Phase 3 candidates)

- **Stockout-with-demand** count — needs `sku_analytics` or `warehouse_inventory_dump` populated.
- **Expected inbound (forward-looking)** — needs `incoming_quantity` populated by upstream sync.
- **Per-vendor scorecard chart** — relies on dense `vendor_purchase_order_lines` (4 rows today).
- **Inbound-by-company attribution** — needs `company_secondary_sku` populated (5 rows today).
- **Anomaly detection** (z-score / IQR over trends) — re-evaluate after Phase 2 charts are live.
- **Click-through drill-downs** from KPI cards to filtered table views.
- **User-savable dashboard layouts.**
- **Real-time / WebSocket updates** — page is still fetch-on-load + manual refresh.
