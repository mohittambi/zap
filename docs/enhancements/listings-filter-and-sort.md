# Listings & Inventory — Filter & Sort Plan

## Context

Today, every listings/inventory page in the app exposes **only a keyword search** + pagination. Users browsing 7,106 master SKUs have no way to narrow by category, stock state, or tag, and no way to sort by qty or recency. The eleven listings/inventory pages share six API endpoints; some of the underlying services already accept filter parameters that the UI doesn't expose.

This plan adds reusable filter + sort UI on top of those endpoints, in three phases. The same `<ListingsFilters>` and `<ListingsSort>` components (plus a `useListQueryState` hook) get plugged into every page so the experience is consistent and bookmarkable via URL.

## Data reality check (verified 2026-05-08)

| Filter / sort dimension | Status | Notes |
|---|---|---|
| Category | ✅ 259 distinct values across 7,106 listings | Top: "Showpiece - Idols and Figurines" (592), "Wall Clock" (282). Some empty/dash rows (~1,346) treated as `(uncategorised)`. |
| Stock state (in-stock / OOS / below-reorder) | ✅ | Reuses `bins` (1.17M units, 5,956 active rows) and existing `getReorderMetrics`. |
| Tags | ⚠️ 9 tags defined, **0 assignments** in `sku_tag_assignments` | Ship the UI; filter will return empty until upstream tagging happens. Pre-wires the surface so it just lights up later. |
| Warehouse / bin location | ❌ Only **1 warehouse** ("WH-22230") | **Drop from v1.** Trivially adds back to the filter array if a second warehouse is added. |
| Sort: SKU ID (A–Z / Z–A) | ✅ | Lexicographic on `listings.sku_id`. |
| Sort: Available qty | ✅ | `SUM(bins.available_quantity)` per SKU; cheap on `idx_bins`. |
| Sort: Recently added | ✅ | `listings.created_at DESC NULLS LAST`. |
| Sort: 30-day sales velocity | ❌ `sku_analytics` is empty | **Drop from v1.** Wire when sync runs. |

**Net v1 surface:** category + stock state filters; tags as a stubbed filter; SKU/qty/recency as sorts.

## Eleven pages → six APIs

(From a fresh exploration of `src/app/(app)/listings/**` and `src/app/(app)/inventory/**`.)

| Page | API | Currently accepts |
|---|---|---|
| `/listings` (redirects to warehouse) | — | — |
| `/listings/warehouse` | `/api/listings/by_page_v4` | `page, count, search_keyword, tag_ids, min_price, max_price` (server) |
| `/listings/secondary` | `/api/inventory/secondary_listings/paginated` | `page, count, search_keyword, sku_type` |
| `/listings/bulk` | `/api/listings/by_page_v4` | (same as warehouse) |
| `/listings/company-sku` | `/api/company-sku-relations` | `page, count, search_keyword` |
| `/listings/focus` | `/api/focus-lists` | `is_public` |
| `/listings/labels-master` | `/api/labels-master` | `page, count, search_keyword` |
| `/listings/packs-combos` | `/api/inventory/secondary_listings/packs_and_combos/paginated` | `page, count, search_keyword` |
| `/inventory/sku-wise` | `/api/inventory/secondary_listings/sku_wise_details` | single-SKU lookup — **no list, out of scope** |
| `/inventory/secondary` | `/api/inventory/secondary_listings/paginated` | (same as listings/secondary) |
| `/inventory/packs` | `/api/inventory/secondary_listings/packs_and_combos/paginated` | (same as listings/packs-combos) |

The sku-wise page is a single-record drill-in and is excluded; that leaves **10 pages backed by 5 list APIs**.

## Phasing

### Phase A — Warehouse Listings (`/listings/warehouse`) + shared components

Highest-traffic surface and the API already supports tag/price filters. This phase ships the reusable building blocks; later phases wire them up.

**Server (`/api/listings/by_page_v4`):**
- Surface the existing `tag_ids` query param (already accepted) in OpenAPI/types.
- Add `category` (single value, ILIKE for "(uncategorised)" sentinel).
- Add `stock_state` ∈ `in_stock | out_of_stock | below_reorder`.
- Add `sort` ∈ `sku_asc | sku_desc | qty_asc | qty_desc | created_desc`. Default: `sku_asc`.
- Add `category` aggregator endpoint `/api/listings/categories?keyword=` returning `{name, count}[]` (for the picker; with 259 categories we don't load them all up front).

**Frontend — new shared building blocks (used by every later phase):**

| File | Purpose |
|---|---|
| `src/components/listings/listings-filters.tsx` | Toolbar of pill chips: category picker, stock-state segmented control, tags multi-select, "Clear all" |
| `src/components/listings/listings-sort.tsx` | Single `<select>` dropdown — SKU A→Z / Z→A / Qty ↓ / Qty ↑ / Recently added |
| `src/components/listings/sortable-table-head.tsx` | Clickable `<TableHead>` wrapper — toggles asc/desc and reflects current sort with arrow icon. Pages with table layouts use this instead of (or alongside) the dropdown. |
| `src/components/listings/category-picker.tsx` | Combobox-ish picker (search + select) hitting `/api/listings/categories` |
| `src/components/listings/tag-picker.tsx` | Multi-select chip group from `/api/sku-tags` |
| `src/components/listings/stock-state-control.tsx` | Three-button segmented control (Any / In stock / Out / Below reorder) |
| `src/hooks/use-list-query-state.ts` | Hook that syncs filter+sort+page state with URL `?` params via `useSearchParams` + `router.replace`. Same `sort` field powers both the dropdown and the `<SortableTableHead>` clicks. |

**Frontend — `/listings/warehouse/page.tsx`:**
- Add `<ListingsFilters>` + `<ListingsSort>` above the grid.
- Wire to `useListQueryState` so refresh / share-link round-trips state.
- Pass extracted filters as query params to `/api/listings/by_page_v4`.

**Out of scope in Phase A:** modifying secondary/labels/focus/etc. pages. They keep their existing search-only UI until Phase B.

### Phase B — Inventory & secondary listings

Two pages share `/api/inventory/secondary_listings/paginated`, two more share `/api/inventory/secondary_listings/packs_and_combos/paginated`.

**Server changes:**
- `secondary_listings/paginated` — accept `category, stock_state, tag_ids, sort` (it already has `sku_type`).
- `packs_and_combos/paginated` — accept the same set.

**Frontend:**
- Drop `<ListingsFilters>` + `<ListingsSort>` into the four pages: `/listings/secondary`, `/inventory/secondary`, `/listings/packs-combos`, `/inventory/packs`.
- The `sku_type` filter on `secondary_listings` becomes one more chip in `<ListingsFilters>` (only rendered when the page passes `enableSkuTypeFilter` prop).

### Phase C — Labels, Company SKU, Focus

These three are smaller and mostly informational. Apply the same pattern with reduced filter sets:

- `/listings/labels-master` — sort only (SKU asc/desc, recently added). No stock state (the data set isn't stock-keyed.)
- `/listings/company-sku` — filter by `company_id`, sort by SKU. (Reuse `/api/home/companies` for the picker.)
- `/listings/focus` — filter `is_public` is already there; add `sort` over the items inside a list.

## Reusable hook contract

```ts
// src/hooks/use-list-query-state.ts
export type ListQueryState = {
  search: string;
  category: string | null;
  stockState: "in_stock" | "out_of_stock" | "below_reorder" | null;
  tagIds: number[];
  skuType: string | null;            // optional, only set on secondary pages
  sort: "sku_asc" | "sku_desc" | "qty_asc" | "qty_desc" | "created_desc";
  page: number;
};

export function useListQueryState(defaults: Partial<ListQueryState>): {
  state: ListQueryState;
  set: (patch: Partial<ListQueryState>) => void;   // resets page to 1 on filter change
  toApiParams: () => URLSearchParams;
};
```

The hook reads from `useSearchParams()`, writes back via `router.replace(?…)` so the back button works and links are shareable. Empty / default values are stripped from the URL.

## Service-layer changes (one per affected API)

For each list service (`listingsService`, `inventoryService.getSecondaryListingsPaginated`, `inventoryService.getPacksAndCombosPaginated`, `labelsService.listLabelsMaster`, `companySkuService.listCompanySkuRelations`):

1. Accept the new filter params in the `opts` argument; pass through to a `WHERE` clause builder.
2. Replace the current "always sort by SKU asc" `ORDER BY` with a switch on `sort`. Whitelist column → SQL fragment so user input never lands in raw SQL.
3. Stock-state filter joins on `bins` aggregate via the same CTE pattern used by `reorderService.METRICS_CTE` — refactor that into a shared `src/server/sql/listingStockCte.ts` so both services use the same definition (avoid drift).

## File summary

**New (Phase A):**
- `src/components/listings/listings-filters.tsx`
- `src/components/listings/listings-sort.tsx`
- `src/components/listings/category-picker.tsx`
- `src/components/listings/tag-picker.tsx`
- `src/components/listings/stock-state-control.tsx`
- `src/hooks/use-list-query-state.ts`
- `src/server/sql/listingStockCte.ts` (extracted from reorderService)
- `src/app/api/listings/categories/route.ts`
- `src/app/api/sku-tags/route.ts` (if not already a list endpoint — check before; the `tag-picker` needs it)

**Modified (Phase A):**
- `src/server/services/listingsService.ts` — extend `getListingsByPage` opts + ORDER BY whitelist
- `src/app/api/listings/by_page_v4/route.ts` — accept new query params, pass through
- `src/app/(app)/listings/warehouse/page.tsx` — render filters + sort, wire hook

**Modified (Phase B + C):** the corresponding service files, route files, and pages — same shape.

## Verification plan

For each phase, verify in `psql` first, then in the UI:

1. Hand-compute a filtered count e.g. "in-stock listings in 'Wall Clock' category":
   ```sql
   SELECT COUNT(*) FROM listings l
   JOIN bins b ON b.sku_id = l.sku_id AND b.is_deleted = false
   WHERE l.category = 'Wall Clock'
   GROUP BY l.sku_id HAVING SUM(b.available_quantity) > 0;
   ```
   Compare to `/api/listings/by_page_v4?category=Wall%20Clock&stock_state=in_stock&count=1`.
2. Sort verification: load with `sort=qty_desc&count=5`, confirm the response is monotonic non-increasing on `available_quantity`.
3. URL state: apply filters, copy URL, paste in a new tab, confirm filters re-hydrate.
4. Empty/edge: tags filter with no assignments returns 0 rows (expected, since `sku_tag_assignments` is empty in current data) — no error.
5. `npx tsc --noEmit` clean; existing unit tests in `tests/unit/` still pass.
6. Auth — every new query param is whitelisted server-side; no SQL injection vector (pg-style `$N` parametrisation throughout).

## Out of scope (deferred)

- **Warehouse / bin filter** — only one warehouse exists; revisit when a second is added.
- **Tag assignment workflow** — this plan exposes the *filter*; back-office tagging UI/CRUD is separate.
- **30-day sales velocity sort** — needs `sku_analytics` populated by upstream sync.
- **Saved filter presets** ("My low-stock view") — could be added in Phase D as a thin layer over URL-state.
- **Multi-select on category** — v1 is single-category. Multi works fine technically (`= ANY($1::text[])`) but the picker UX is more work; revisit if requested.
- **Free-text price range filter** — the API already supports `min_price/max_price` but it isn't a v1 chip; trivial to add.
- **`/inventory/sku-wise`** — single-SKU lookup, no list to filter.
- **Inline column sort headers in tables** (e.g. clickable `<TableHead>`s) — defer until grid pages also need it; v1 uses the dropdown.
