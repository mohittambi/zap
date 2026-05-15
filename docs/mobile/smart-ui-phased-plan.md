# Zap Ops Mobile — Smart UI & Metrics Implementation Plan

**Version:** 1.0  
**Target:** Client delivery readiness  
**Screens affected:** 14 screens across 3 phases  
**New files:** 1 repository helper (`home.repository.ts`)  
**New backend endpoints:** 0 (all data from existing APIs)

---

## Phase 1 — High Impact (Home + Core Hubs)

### 1.1 Home Screen Dashboard

**File:** `mobile/src/features/home/HomeScreen.tsx`  
**New file:** `mobile/src/features/home/home.repository.ts`  
**Effort:** Large  
**Impact:** Highest — first screen every user sees

**Current state:** Static tile grid ("Quick access"). No live data. User must navigate
to each module to discover what needs attention.

**Target layout:**

```
┌─── Hero (existing, keep) ─────────────────────────────────┐
│  [Logo] Zap Ops                               [≡ Menu]   │
│  Listings, inventory & logistics                          │
└───────────────────────────────────────────────────────────┘

┌─── At a Glance (scrollable KpiRibbon) ────────────────────┐
│ [Listings 2,481] [SKUs 892] [Vendors 34] [POs 156] [GRNs 48] │
└───────────────────────────────────────────────────────────┘

┌─── Needs Attention (conditional alert cards) ─────────────┐
│ ⚠ 12 Pending Audits            → Inbound > Pending Audits│
│ ⚠  3 Pending Invoices (OB)     → Outbound > Pending Inv. │
│ ⚠  7 Pending Invoice Collection → Inbound > Collection   │
│ ⚠  2 Debit/Credit Notes        → Inbound > Debit/Credit  │
└───────────────────────────────────────────────────────────┘

┌─── Quick Access (existing tiles, compact height) ─────────┐
│ [Listings] [Outbound] [Inbound] [Warehouses] [Labels] ...│
└───────────────────────────────────────────────────────────┘
```

**Data sources (all existing APIs, `page=1, count=1` for totals):**

| Metric | API call | Field |
|--------|----------|-------|
| Total Listings | `listings/by_page_v4?page=1&count=1` | `.total` |
| Secondary SKUs | `inventory/secondary_listings/paginated?page=1&count=1` | `.total` |
| Active Vendors | `vendors/all` | array `.length` |
| Outbound POs | `outbound/purchase-orders?page=1&count=1` | `.total` |
| Inbound GRNs | `inbound/grns?page=1&count=1` | `.total` |
| Warehouses | `warehouses` | array `.length` |

**Attention card sources:**

| Card | API | Condition |
|------|-----|-----------|
| Pending Audits | `inbound/pending-audits/grns?page=1&count=1` | `total > 0` |
| Pending Invoices (OB) | `outbound/consignments?pending_invoice=true&page=1&count=1` | `total > 0` |
| Pending Invoice Collection | `inbound/pending-invoice-collection/grns?page=1&count=1` | `total > 0` |
| Debit/Credit Notes | `inbound/pending-debit-credit/notes?page=1&count=1` | `total > 0` |

**Technical details:**
- `home.repository.ts` with `fetchDashboardCounts(api)` — fires all 10 calls via `Promise.allSettled`
- Single `useQuery` with `staleTime: 60_000`, `refetchInterval: 120_000`
- Reuses `KpiRibbon` for "At a Glance" strip
- Attention cards: colored left rail (`danger`/`warning`), bold count, title, right-arrow, `Pressable` navigates
- RBAC-aware: metrics only shown for modules the user has access to
- Quick Access tiles kept but `minHeight` reduced to `72/60` (compact)

---

### 1.2 Outbound Home — Metric Cards

**File:** `mobile/src/features/outbound/OutboundHomeScreen.tsx`  
**Effort:** Medium

**Current state:** 6 `AppButton` rows. No numbers.

**Target:** Tappable metric cards with live counts above the button list.

| Card | Number source | Color |
|------|--------------|-------|
| Purchase Orders | `outbound/purchase-orders?page=1&count=1` → total | `primary` |
| Partially Created POs | `outbound/purchase-orders?status=PARTIAL&page=1&count=1` → total | `warning` |
| Consignments | `outbound/consignments?page=1&count=1` → total | `blue` |
| Pending Invoices | `outbound/consignments?pending_invoice=true&page=1&count=1` → total | `danger` |

Non-counted actions (Add new PO, Packing Settings) remain as plain `AppButton` below.

**Card layout:**
```
┌──────────────────────────────────────────────────┐
│  156                           Purchase Orders → │
│  All open and historical purchase orders         │
└──────────────────────────────────────────────────┘
```
Number: `font.titleLarge` bold, colored. Title: `font.body` 600. Subtitle: `font.bodySmall` muted.
Uses `buildCardSurface`. Press scale animation.

---

### 1.3 Inbound Home — Metric Cards

**File:** `mobile/src/features/inbound/InboundHomeScreen.tsx`  
**Effort:** Medium

**Current state:** 7 `AppButton` rows.

**Target:** 5 counted metric cards + 2 plain navigation buttons.

| Card | Number source | Color |
|------|--------------|-------|
| Purchase Orders | `inbound/purchase-orders?page=1&count=1` → total | `primary` |
| All GRNs | `inbound/grns?page=1&count=1` → total | `blue` |
| Pending Audits | `inbound/pending-audits/grns?page=1&count=1` → total | `danger` when > 0 |
| Pending Invoice Collection | `inbound/pending-invoice-collection/grns?page=1&count=1` → total | `warning` when > 0 |
| Debit/Credit Notes | `inbound/pending-debit-credit/notes?page=1&count=1` → total | `warning` when > 0 |

Plain buttons (no count): Vendors, SKU-wise view.

---

## Phase 2 — Medium Impact (List Screens Polish)

### 2.1 Catalogues Screen — Cards + Search + View Prefs

**File:** `mobile/src/features/catalogues/CataloguesScreen.tsx`  
**cardPrefs key:** `'catalogues'`  
**Effort:** Medium

**Current state:** Plain text rows, name only. No search, no cards, no grid.

**Target:**
- `AppSearchBar` (client-side filter, API does not accept search param)
- `ScreenCardPrefsScope` + `EffectiveViewPrefsBar` (list/grid, compact/comfortable)
- `CatalogueCard`: avatar circle with initial, name bold, ID chip, press animation
- Result count badge
- Grid mode: 48% tiles

---

### 2.2 Company-SKU Screen — Cards + Search + View Prefs

**File:** `mobile/src/features/company-sku/CompanySkuScreen.tsx`  
**cardPrefs key:** `'company_sku'`  
**Effort:** Medium

**Current state:** `RecordRow` list, no search, no view toggle.

**Target:**
- `AppSearchBar` (client-side filter over loaded rows)
- `ScreenCardPrefsScope` + `EffectiveViewPrefsBar`
- `CompanySkuCard`: company name, SKU, relation type as chips
- Result count badge

---

### 2.3 Focus Lists Screen — Card Layout

**File:** `mobile/src/features/focus/FocusListsScreen.tsx`  
**Effort:** Small

**Current state:** Raw `DataPreview` dump of the API response.

**Target:**
- Parse response into individual focus list items
- Each item as a card: name bold, item count badge, created date chip

---

### 2.4 Warehouses Screen — KPI Strip + Cards + Search + View Prefs

**File:** `mobile/src/features/warehouses/WarehousesScreen.tsx`  
**cardPrefs key:** `'warehouses'`  
**Effort:** Medium

**Current state:** Title + plain text rows.

**Target:**
- KPI strip: Total Warehouses count + `warehouses` array length
- Each warehouse as a card: avatar circle (initial), name bold, ID chip
- `AppSearchBar` (client-side)
- `ScreenCardPrefsScope` + `EffectiveViewPrefsBar`
- Add `'warehouses'` to `ScreenPrefKey`

---

### 2.5 Labels Master Screen — Count Badge + View Prefs

**File:** `mobile/src/features/labels/LabelsMasterScreen.tsx`  
**cardPrefs key:** `'labels'`  
**Effort:** Small

**Current state:** Has search already. Bare `RecordRow`. No count, no view toggle.

**Target:**
- `ScreenCardPrefsScope` + `EffectiveViewPrefsBar`
- Result count badge from `total`
- `RecordRow` already adapts to view prefs

---

## Phase 3 — Detail & Polish (Professional Finish)

### 3.1 Vendor Detail Screen — Structured Layout

**File:** `mobile/src/features/vendors/VendorDetailScreen.tsx`  
**Effort:** Medium

**Current state:** Single `DataPreview` dump.

**Target:**
- Hero header: vendor name, avatar circle, ID chip
- Smart `DataPreview` already handles two-column layout

---

### 3.2 Catalogue Detail Screen — Structured Layout

**File:** `mobile/src/features/catalogues/CatalogueDetailScreen.tsx`  
**Effort:** Medium

**Current state:** Single `DataPreview` dump.

**Target:**
- Hero header: catalogue name, ID
- Item count badge from API response
- `DataPreview` handles structured fields

---

### 3.3 Settings Screen — System Info Card

**File:** `mobile/src/features/settings/SettingsScreen.tsx`  
**Effort:** Small

**Target:** "System" section below Account:
- API endpoint (masked domain)
- Cache entries count (`queryClient.getQueryCache().getAll().length`)
- App version + build number
- Platform info (`Platform.OS` + `Platform.Version`)

---

### 3.4 Outbound PO Journey — Tab Count Badges

**File:** `mobile/src/features/outbound/PoJourneyScreen.tsx`  
**Effort:** Small

**Current state:** Already has `KpiRibbon` and cards — the gold standard.

**Target:** Minor polish — add result count badges to each tab.

---

## Shared Infrastructure Changes

### `cardPrefs.tsx` — New ScreenPrefKeys Added Across Phases

```
| 'catalogues'   // Phase 2.1
| 'company_sku'  // Phase 2.2
| 'warehouses'   // Phase 2.4
| 'labels'       // Phase 2.5
```

### `home.repository.ts` — New File (Phase 1.1)

Parallel fetch of all dashboard counts using `Promise.allSettled` to prevent
any single failing API from blocking the entire dashboard.

---

## File Change Summary

| Phase | Files modified | New files |
|-------|---------------|-----------|
| 1 | `HomeScreen.tsx`, `OutboundHomeScreen.tsx`, `InboundHomeScreen.tsx` | `home.repository.ts` |
| 2 | `CataloguesScreen.tsx`, `CompanySkuScreen.tsx`, `FocusListsScreen.tsx`, `WarehousesScreen.tsx`, `LabelsMasterScreen.tsx`, `cardPrefs.tsx` | — |
| 3 | `VendorDetailScreen.tsx`, `CatalogueDetailScreen.tsx`, `SettingsScreen.tsx`, `PoJourneyScreen.tsx` | — |

**Total: 14 screens, 1 new file, 0 new API endpoints.**

---

## Implementation Order

**Phase 1** (first — client sees home screen immediately)
1. Create `home.repository.ts` with `fetchDashboardCounts`
2. Redesign `HomeScreen.tsx`: KPI ribbon + attention cards + compact quick access
3. Redesign `OutboundHomeScreen.tsx`: metric cards with live counts
4. Redesign `InboundHomeScreen.tsx`: metric cards with live counts

**Phase 2** (list screens polish — consistency across the app)
5. Add `catalogues`, `company_sku`, `warehouses`, `labels` to `cardPrefs.tsx`
6. Redesign `CataloguesScreen.tsx`: search + cards + view prefs
7. Redesign `CompanySkuScreen.tsx`: search + cards + view prefs
8. Redesign `FocusListsScreen.tsx`: card layout
9. Redesign `WarehousesScreen.tsx`: KPI strip + cards + search + view prefs
10. Enhance `LabelsMasterScreen.tsx`: count badge + view prefs

**Phase 3** (detail polish — professional finish)
11. Enhance `VendorDetailScreen.tsx`: hero + structured sections
12. Enhance `CatalogueDetailScreen.tsx`: hero + structured sections
13. Add system info to `SettingsScreen.tsx`
14. Polish `PoJourneyScreen.tsx` tab count badges

---

## Design Uniformity Checklist

All screens must follow these rules for consistency:

- **Cards:** `buildCardSurface(colors, cardStyle)` for elevated/outlined
- **Typography:** `font.titleLarge` bold for primary numbers, `font.body` 600 for titles, `font.bodySmall` for subtitles/metadata
- **Spacing:** `spacing.lg` horizontal padding, `spacing.md` vertical between sections, `spacing.sm` between chips
- **Avatar circles:** `width: 40, height: 40, borderRadius: 20`, background from first char hash
- **Status colors:** `colors.success` (dispatched/active), `colors.warning` (pending/partial), `colors.danger` (expired/overdue), `colors.primary` (neutral counts)
- **Count badges:** `font.bodySmall`, `colors.textMuted`, displayed as "N results"
- **Search bars:** `AppSearchBar` component, debounced 350ms for server-side, immediate for client-side
- **View prefs:** `ScreenCardPrefsScope` + `EffectiveViewPrefsBar` for all list screens
- **Animations:** Spring scale on press (`Animated.spring` to 0.96), count-up for KPI numbers
- **Loading state:** `ActivityIndicator` with `commonLayout.loaderTop`
- **Empty state:** `EmptyState` component with descriptive title
- **Error state:** `ErrorBanner` component
