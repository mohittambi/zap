# Home Dashboard — Phase 3 Plan

## Context

Phases 1 and 2 ([planning-to-create-a-polymorphic-phoenix.md](../../../../.claude/plans/planning-to-create-a-polymorphic-phoenix.md), [home-dashboard-phase-2.md](./home-dashboard-phase-2.md)) shipped a static-but-rich operations dashboard at `/`: 9 KPI cards, 2 trend charts with 90-day daily series, a reorder-alerts strip, channel-mix bar chart, and a saved-query panel.

Phase 3 makes the dashboard **interactive** instead of just informative. Three additions:

1. **Anomaly markers on trend charts** — surface unusual spikes/dips on the existing line charts so an ops owner doesn't need to eyeball them.
2. **Click-through drill-downs from KPI cards** — every card becomes a link into a filtered list view, so "9,724 inbound qty" or "97 below reorder" lead somewhere actionable.
3. **Savable per-user dashboard layouts** — let each user choose which cards they care about. Foundation for future personalisation (default company, ordering, named layouts).

Item #2 depends on the listings filter+sort work ([listings-filter-and-sort.md](./listings-filter-and-sort.md)) — drill-downs only make sense once filtered URLs are real.

## Item 1 — Anomaly markers (z-score on trend series)

### What it shows

On the existing two trend charts (sales qty, inbound qty), each daily point that is more than **2.5σ from the rolling 30-day mean** gets a red dot and a tooltip line "**Anomaly: x.yσ above/below 30-day mean**". A small footnote under each chart lists the count: "*3 anomalies in the last 90 days*".

### Why z-score and not IQR

z-score is cheap, deterministic, and intuitive when the user explains "this day was 3σ above normal". IQR is more robust to skew but harder to verbalise on a tooltip; ops series here are large counts and tend to be approximately log-normal, so z-score on raw values is good enough for a first cut. Threshold tuned later if it cries wolf — start at **2.5σ** (catches strong outliers, ignores ordinary noise).

### Implementation

**Backend** — extend `getHomeSummary` to compute, per series, `mean` and `stdDev` over a trailing 30-day window for each point in the 90-day series. Add a per-point `anomaly_z: number | null` (null when within threshold).

```ts
// in homeSummaryService.ts
export type TrendPoint = {
  day: string;
  v: number;
  v_prev_year: number;
  anomaly_z: number | null;   // signed z-score when |z| >= ANOMALY_Z_THRESHOLD, else null
};
```

Computation in pure JS after the SQL pulls daily data — no SQL change. Helper:

```ts
function flagAnomalies(series: { day: string; v: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 30; i < series.length; i++) {
    const win = series.slice(i - 30, i);                 // trailing 30 days
    const mean = win.reduce((s, p) => s + p.v, 0) / 30;
    const variance = win.reduce((s, p) => s + (p.v - mean) ** 2, 0) / 30;
    const sd = Math.sqrt(variance);
    if (sd === 0) continue;
    const z = (series[i].v - mean) / sd;
    if (Math.abs(z) >= 2.5) out.set(series[i].day, z);
  }
  return out;
}
```

**Frontend** — `trend-chart.tsx` overlays a Recharts `<Scatter>` series for points with non-null `anomaly_z`. Tooltip header gains an extra line when hovering an anomalous day.

### Out-of-scope (defer)

- Anomaly detection on the saved-query line chart (`daily_outbound_trend`) — apply later if it proves useful on the home charts first.
- Configurable threshold via UI — hardcoded 2.5σ for v1.
- IQR or MAD as alternatives — revisit if z-score over-fires on weekly seasonality.

## Item 2 — Click-through drill-downs from KPI cards

### Mapping

| Card | Click goes to | Notes |
|---|---|---|
| Sales orders (qty) | `/outbound?from=<from>&to=<to>&company_id=<id>` | Existing outbound list page; needs the same filter shape used by listings work. |
| Sales POs raised | `/outbound/purchase-orders?from=&to=&company_id=` | Same. |
| Avg fill rate | `/outbound?from=&to=` (sorted by fill rate asc) | Lands on lowest-fill-rate consignments. |
| Inbound received (qty) | `/inbound?from=&to=` | All-vendors view. |
| SKUs below reorder | `/reorder` (existing page, `alerts_only=true` already wired) | Already a link target — change badge to a `<Link>`. |
| Ops queues sub-counts | Each row → its module page (existing in `OpsQueuesCard`) | **Already done** in Phase 2. |
| Open sales POs | `/outbound/purchase-orders?status=OPEN&aged=true` | Needs `aged` URL param to be a meaningful filter. |
| Vendor quality | `/inbound?from=&to=` sorted by rejection % desc | Reuses inbound list. |
| Inventory snapshot — units on hand | `/listings/warehouse?stock_state=in_stock` | Depends on listings Phase A. |
| Inventory snapshot — SKUs at zero | `/listings/warehouse?stock_state=out_of_stock` | Depends on listings Phase A. |
| Channel mix bar | Click bar → `/?company_id=<id>` (re-renders home with filter) | Stays on dashboard; doesn't leave the page. |

### Implementation

- Wrap each KPI card body in a `<Link>` (or use `<button onClick={router.push(...)}>` for keyboard accessibility).
- Add a small `<ArrowUpRight>` icon top-right on each card (matches existing `ops-queues-card.tsx` style).
- Where the target page doesn't yet support a filter (`aged`, `from`/`to` on outbound list), add it as part of this work — list page filtering is the same pattern as the listings filter+sort work.

### Dependencies

This depends on:
- **Listings Phase A** for the `stock_state` URL param on warehouse listings.
- **A small extension** to outbound and inbound list pages to honour `from` / `to` / `company_id` query params (mostly already there in stubbed form; verify before implementation).

## Item 3 — Savable per-user dashboard layouts

### v1 scope (deliberately small)

**One persistent setting per user**: a list of card IDs they want to **show**. Order is fixed (matches `home-content.tsx`); we surface a "Customise dashboard" toggle that opens a panel with checkboxes, persists to the server, and re-renders on save.

```
v1: per-user array of visible card IDs ∈ {sales_qty, sales_pos, fill_rate, ...}
v2 (deferred): drag-reorder, multiple named layouts, defaults per role
```

This is small enough to ship cleanly and pre-wires the schema for v2.

### Schema

New migration `058_user_dashboard_prefs.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_dashboard_prefs (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  layout      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`layout` shape (extensible for v2):

```ts
type DashboardLayout = {
  visible_cards: string[];        // ordered card IDs the user wants visible
  default_company_id?: number | null;
};
```

Falls back to a default layout (all cards visible) when the row is absent.

### API

- `GET  /api/home/prefs`  → `{layout: DashboardLayout}` (creates default if missing)
- `PUT  /api/home/prefs`  → body `{layout: DashboardLayout}`, validates `visible_cards` against the known card-ID enum.

Both gated by `requireAuth` (no extra permission — every authenticated user gets one).

### Frontend

- `src/hooks/use-dashboard-prefs.ts` — fetch + cache + mutate.
- `src/components/home/customise-dashboard-sheet.tsx` — slide-over panel triggered from a "Customise" icon button next to the page title. Lists every card with a checkbox, "Save" button.
- `src/components/home/home-content.tsx` — wraps each card section in a `prefs.visible_cards.includes(id)` guard. Default = show all when prefs haven't loaded yet.

### Out-of-scope (deferred to v2)

- **Drag-reorder** — needs `@dnd-kit/core` or similar. Skip until the visible-cards control is validated.
- **Multiple named layouts** ("Daily" vs "Weekly review") — enum is already JSONB so v2 just adds a name field and an array of layouts.
- **Per-role defaults** — admins might want a different default than warehouse staff; defer.
- **Sharing layouts** between users.

## Phasing

This Phase 3 is independent of listings Phase A/B/C **except** for Item 2 drill-downs, which need the listings filter URL contract.

```
Order:
  Listings Phase A  (foundation, drill-downs depend on it)
  Listings Phase B  (broaden coverage)
  Listings Phase C  (final pages)
  Dashboard 3.1     anomaly markers (no dependencies)
  Dashboard 3.2     drill-downs (depends on listings A; some inbound/outbound list filters too)
  Dashboard 3.3     savable layouts (no dependencies)
```

Items 3.1 and 3.3 can ship in either order; 3.2 must come after listings A.

## Verification (per item)

**3.1 Anomaly markers**
- Inject a synthetic spike via direct DB write (or a fixture) and confirm a red dot renders.
- Hand-compute z = (v − mean) / sd for one day in `psql`; compare to API response.
- Tooltip text shows the σ value.

**3.2 Drill-downs**
- Click each KPI card → verify URL contains the expected `?` params and the destination page renders the filtered subset.
- Channel-mix bar click → confirm `/?company_id=` updates the filter without a navigation.

**3.3 Savable layouts**
- New user → all cards visible (default).
- Uncheck two cards in the Customise sheet → save → reload `/` → those cards stay hidden.
- Different user account → independent layout.

## Out of scope (Phase 4 candidates)

- Real-time / WebSocket updates.
- AI assistant on the dashboard ("Why did sales drop on May 3?").
- Cross-period compare beyond MoM/YoY (e.g. custom date-range comparison).
- Forecasting (Holt-Winters, Prophet) — out-of-scope until anomaly markers prove value.
- Dashboard exports (PDF / scheduled email).
