# Inventory & Listings — Mobile UI Overhaul

**Status:** PLAN — awaiting implementation approval  
**Scope:** 3 screens + 1 shared token update  
**Design system:** Existing Zap Material 3 tokens (spacing, radius, font, AppColors)

---

## Motivation

The current Inventory and Listings screens are placeholder-quality text rows, fundamentally at odds with the polished outbound UI the app already has. Every row is just SKU text with a hairline divider — no card surfaces, no metric context, no hierarchy, no density/layout controls.

This plan specifies a card-first, data-rich redesign for:

| Screen | Route | Current State |
|--------|-------|---------------|
| `ListingsScreen` | Drawer › Listings | Plain text row: SKU + description |
| `SecondaryListingsScreen` | Drawer › Inventory | Plain text row: secondary SKU + master SKU |
| `SkuDetailScreen` | Listings › SKU Detail | 7 raw `DataPreview` JSON dumps |

---

## Design Language (consistent with outbound)

| Token | Value |
|-------|-------|
| Card radius | `radius.md` (12dp) / `radius.lg` (16dp) for Bento cells |
| Card surface | `buildCardSurface(colors, prefs.cardStyle)` |
| Spacing unit | 4dp base (`spacing.xs=4, sm=8, md=16, lg=24, xl=32`) |
| Typography | `font.mono` for SKU IDs; `font.titleMedium` / `font.bodySmall` for body |
| Numeric alignment | `fontVariant: ['tabular-nums']` |
| Status colors | `colors.success` / `colors.warning` / `colors.danger` / `colors.primary` |
| Muted backgrounds | `colors.successMuted` / `colors.warningMuted` / `colors.primaryMuted` |

---

## 1. `cardPrefs.tsx` — new ScreenPrefKey

Add `'listings_main'` to `ScreenPrefKey` so `ListingsScreen` can have its own list/grid + density preference.

```ts
// Before
export type ScreenPrefKey = 'outbound_pos' | 'inbound_vendors' | ... | 'inventory_listings';

// After — add one key
export type ScreenPrefKey = 'outbound_pos' | 'inbound_vendors' | ... | 'inventory_listings' | 'listings_main';
```

---

## 2. `ListingsScreen` — `ListingCard`

### Current
Plain `Pressable` with `sku_id` text and `description` text, no surface, no visual hierarchy.

### Target
```
LIST MODE
┌──────────────────────────────────────────────────────────┐
│ ┌──────┐  SKU-ABCDEF-123                         [→]    │
│ │  SKU │  Product description here, up to 2 lines…      │
│ │  img │  ─────────────────────────────────────────     │
│ └──────┘  [Category]  [Brand]  [Type]                   │
└──────────────────────────────────────────────────────────┘

GRID MODE (48% width)
┌──────────────────┐
│  ┌────────────┐  │
│  │  SKU icon  │  │
│  └────────────┘  │
│  SKU-ABCDEF-123  │
│  Description…    │
│  [Category]      │
└──────────────────┘
```

### Component spec — `ListingCard`

```tsx
// Props: item (Record<string,unknown>), onPress()

// List layout:
// - Left: 56×56 rounded image placeholder (colors.primaryMuted background,
//         first char of sku_id in colors.primary, font.titleMedium bold)
// - Right column:
//     • SKU ID: font.mono, fontWeight '700', colors.text
//     • Description: font.bodySmall, colors.textMuted, numberOfLines={compact ? 1 : 2}
//     • Chip row (if not compact): max 3 chips from [category, brand, product_type]
//       Each chip: colors.surfaceMuted bg, hairline border, font.label, 10px

// Grid layout (isGrid):
// - Image placeholder centered, 64×64
// - SKU bold, centered, numberOfLines={1}
// - Description centered, numberOfLines={2}
// - One chip below (category or brand)

// Press animation: Animated.spring scale 0.97 on pressIn, spring back on pressOut
// Card surface: buildCardSurface(colors, prefs.cardStyle)
// Outer card margin: horizontal spacing.sm, vertical spacing.xs
```

### Screen changes
- Wrap `ListingsScreen` content in `ScreenCardPrefsScope screenKey="listings_main"`.
- Add `EffectiveViewPrefsBar showLayout labeled` below the search bar.
- Wire `FlatList` to `numColumns={isGrid ? 2 : 1}`, `key` toggle, `columnWrapperStyle` for grid.
- Add a result count badge: `"{total} listings"` in `font.label` / `colors.textMuted` between ViewPrefsBar and FlatList.

---

## 3. `SecondaryListingsScreen` — `InventorySkuCard`

### Current
`ListingTile` — grid or list text rows (from the previous sprint). Already has grid/list toggle but content is bare text.

### Target
```
LIST MODE
┌──────────────────────────────────────────────────────────┐
│  ● S  │  secondary-sku-id                    [ACTIVE]   │
│       │  Master › master-sku-id                         │
│       │  ──────────────────────────────────────────     │
│       │  [Packs/Combos]  [ID: 1234]                     │
└──────────────────────────────────────────────────────────┘

GRID MODE (48% width)
┌───────────────────┐
│       ● S         │
│  secondary-sku    │
│  Master: mst-sku  │
│  [ID: 1234]       │
└───────────────────┘
```

### Component spec — `InventorySkuCard`

```tsx
// Replaces ListingTile. Same isGrid / compact from useEffectiveCardPrefs.

// Avatar circle (36dp diameter):
// - Background: deterministic color from first char of secondary_sku
//   (cycle through [primaryMuted, successMuted, warningMuted, dangerMuted])
// - Letter: first char uppercase, font.titleMedium, matching semantic color

// Status badge (top-right, LIST mode only):
// - "ACTIVE" badge: successMuted bg, success text, font.label, radius.sm
//   (no status field in API yet — show badge unconditionally; remove if null when API adds it)

// Divider + metadata row (below primary text, compact = hidden):
// - "ID: {item.id}" chip
// - If item has packs/combos flag in future: [Packs/Combos] chip

// Press: same scale spring animation, buildCardSurface

// Card margins: horizontal spacing.sm, vertical spacing.xs (grid: marginBottom spacing.sm)
```

### Search bar
The API accepts `search_keyword`. Add a `TextInput`-based search bar at the top of the screen using the existing `AppSearchBar` component (already used in `ListingsScreen`). Wire with `useDebounced(search, 350)` and pass to the `queryKey` + `fetchSecondaryListingsPage` call.

### Result count badge
Same as ListingsScreen: show `"{total} items"` in `font.label` / `colors.textMuted`.

---

## 4. `SkuDetailScreen` — Hero + 5-Tab Layout

This is the biggest redesign. The current screen is a developer-debug view with 7 raw `DataPreview` JSON blocks. The new version presents the same data in structured, human-readable sections organized into tabs.

### Hero Header (static, above scrollable content)

```
┌──────────────────────────────────────────────────────────┐
│  ┌─────┐  SKU-ABCDEF-123                                 │
│  │     │  Product description (if in detail response)    │
│  │ PLH │  ──────────────────────────────────────────    │
│  └─────┘  [Category]  [Brand]  [MRP: ₹999]              │
└──────────────────────────────────────────────────────────┘
```

- 80×80 image placeholder (SKU initial, `primaryMuted` background).
- SKU in `font.mono`, bold 22px.
- Description from `detail.data.description` (or closest field), `font.bodySmall`, 2 lines.
- Chip row: 3 chips from detail data — degrade gracefully if fields absent.
- Background: `colors.surface`, bottom `hairlineWidth` border `colors.border`.

### Tab bar

5 tabs via existing `AppTabBar<SkuTab>` (already used in `PoDetailScreen`):

| Key | Label | Data source |
|-----|-------|-------------|
| `overview` | Overview | `fetchSkuDetail` |
| `inbound` | Inbound | `fetchSkuInboundSummary` + `fetchSkuIncomingQuantity` |
| `outbound` | Outbound | `fetchSkuOutboundSummary` + `fetchSkuAnalytics` |
| `warehouse` | Warehouse | `fetchWarehouseDumpPage` |
| `packs` | Packs | `fetchPacksCombosForSku` + `fetchIncomingPoLinesPage` |

Tab bar anchored at bottom using the same flex layout as `PoDetailScreen` (flex: 1 container, tab content fills, `AppTabBar` at bottom).

### Tab 1 — Overview

```
ScrollView:
  ┌──────────────────┐  ┌──────────────────┐
  │  INCOMING QTY    │  │  OUTBOUND DEMAND  │
  │  1,234   [blue]  │  │    892   [grey]   │
  └──────────────────┘  └──────────────────┘
  ┌──────────────────┐  ┌──────────────────┐
  │  PACKED          │  │  DISPATCHED       │
  │    650   [blue]  │  │    242   [green]  │
  └──────────────────┘  └──────────────────┘

  FillRateBar (skuRate from outbound summary if available)

  ── Product Info ──────────────────────────────────────────
  Key-value card (surface card):
    Description  | …
    Category     | …
    Brand        | …
    Weight       | …
    Dimensions   | …
  (All fields from detail.data, displayed with KeyValueRow)
```

- Reuse `BentoMetricGrid` (already in `shared/ui/`). Map fields from `detail.data` (parse best-effort since API returns `unknown`; use `as Record<string,unknown>` with null-checks).
- Create a `KeyValueCard` helper component (inline, not a new file) that renders an array of `{label, value}` pairs in a card surface.

### Tab 2 — Inbound

```
ScrollView:
  ── Inbound Summary ──────────────────────────────────────
  KeyValueCard from fetchSkuInboundSummary

  ── Incoming Quantity ─────────────────────────────────────
  KeyValueCard from fetchSkuIncomingQuantity
  
  ── Incoming PO Lines (page 1) ────────────────────────────
  List of PO line rows using RecordRow
```

### Tab 3 — Outbound

```
ScrollView:
  ── Outbound Summary ─────────────────────────────────────
  MetricRow (4 MetricPills) if demand/packed/dispatched fields present
  KeyValueCard for remaining fields

  ── Analytics ────────────────────────────────────────────
  KeyValueCard from fetchSkuAnalytics
```

### Tab 4 — Warehouse

```
ScrollView/FlatList:
  ── Warehouse Inventory ──────────────────────────────────
  List of rows. Each row uses a compact inline card:
    [Location code]  Qty: {qty}  [Status badge]
```

### Tab 5 — Packs / Combos

```
ScrollView:
  ── Packs & Combos ───────────────────────────────────────
  KeyValueCard from fetchPacksCombosForSku

  ── Incoming PO Lines ─────────────────────────────────────
  KeyValueCard from fetchIncomingPoLinesPage (page 1)
```

### Loading states
Each tab shows an `ActivityIndicator` centered while its own query loads. Other tabs' queries are all initiated after `detail.isSuccess` (existing sequential pattern) and run in parallel — no change to the existing data-fetching strategy.

### Error states
Each section shows `ErrorBanner` if its query fails — same pattern as current.

---

## 5. `types.ts` navigation param update

```ts
// Before
SkuDetail: {skuId: string};

// After
SkuDetail: {skuId: string; initialTab?: 'overview' | 'inbound' | 'outbound' | 'warehouse' | 'packs'};
```

`SkuDetailScreen` reads `route.params.initialTab` and sets `useState<SkuTab>(initialTab ?? 'overview')`.

---

## New shared helper — `KeyValueCard` (inline, not a separate file)

Used in `SkuDetailScreen` to replace all `DataPreview` sections:

```tsx
// Inline component in SkuDetailScreen.tsx:
function KeyValueCard({ title, data, loading, error }: { ... }) {
  // Renders a card surface with title string, then key-value rows
  // Each row: label (textMuted, font.bodySmall) | value (text, font.body, textAlign right)
  // Gracefully skips null/undefined values
  // Shows ActivityIndicator if loading
  // Shows ErrorBanner if error
}
```

---

## File change summary

```
mobile/src/shared/ui/cardPrefs.tsx                        → add 'listings_main' ScreenPrefKey
mobile/src/features/listings/ListingsScreen.tsx           → ListingCard, grid/list, view prefs bar
mobile/src/features/listings/SkuDetailScreen.tsx          → hero + 5-tab layout, KeyValueCard
mobile/src/features/inventory/SecondaryListingsScreen.tsx → InventorySkuCard, search bar
mobile/src/app/navigation/types.ts                        → initialTab param on SkuDetail
```

No new component files required — all new UI logic lives inline in the feature files.

---

## Implementation TODOs (in order)

1. `cardprefs-listings` — Add `'listings_main'` to `ScreenPrefKey` in `cardPrefs.tsx`
2. `listings-card` — Redesign `ListingsScreen`: `ListingCard`, grid/list toggle, `ScreenCardPrefsScope`
3. `inventory-sku-card` — Redesign `SecondaryListingsScreen`: `InventorySkuCard`, search bar, result count
4. `sku-detail-hero` — Redesign `SkuDetailScreen`: hero header + 5-tab layout
5. `nav-types` — Add `initialTab` to `ListingsStackParamList.SkuDetail`
