# Outbound Mobile UI — Redesign Specification
**Status: DRAFT — Awaiting approval before implementation**
**Scope:** React Native (0.85) · `mobile/src/features/outbound/` · All three existing themes (`light`, `dark`, `studio`)

---

## Section 1 — UI/UX Architecture & Design System

### 1.1 Design Language

The redesign adopts a **Material 3 / Bento-style** system. The two guiding principles are:

1. **Surface depth over flat colour.** Elevation is communicated through shadow + tonal surface shift, not heavy borders.
2. **Data as the hero.** Numbers are large, monospaced, and coloured. Labels are small, muted, and demoted.

#### 1.1.1 Grid & Spacing

The existing `spacing` scale (`xs = 4`, `sm = 8`, `md = 16`, `lg = 24`, `xl = 32`) is retained verbatim.
All padding and gap values in new components are expressed as multiples of **4 dp** (the existing `xs` unit) to maintain grid alignment.

| Use | Value |
|-----|-------|
| Intra-card gap | 8 dp (`spacing.sm`) |
| Card padding | 16 dp (`spacing.md`) |
| List item horizontal margin | 16 dp (`spacing.md`) |
| Section header top margin | 24 dp (`spacing.lg`) |
| Bottom sheet handle area | 24 dp |

#### 1.1.2 Corner Radius

| Component | Radius | Token |
|-----------|--------|-------|
| List-row card (full-bleed variant) | 0 (no change) | — |
| Elevated company / PO card | 12 dp | `radius.md` (existing) |
| Bento metric cell | 16 dp | `radius.lg` (new token: `16`) |
| Bottom sheet container | 20 dp top corners | `radius.xl` (new token: `20`) |
| Progress bar pill | 6 dp | `radius.full` (existing) |
| Image thumbnail in media card | 12 dp | `radius.md` |
| Chip / badge | full pill | `radius.full` |

No new spacing tokens are introduced. A `radius.lg = 16` and `radius.xl = 20` value will be appended to `shared/ui/theme.ts`.

---

### 1.2 Color-State Logic

#### 1.2.1 Palette mapping

The four metric states map onto existing semantic variables in `AppColors`:

| Metric | Semantic token | Light HEX | Dark HEX | Studio HEX |
|--------|---------------|-----------|----------|------------|
| **Demand** | `textSecondary` / neutral | `#475569` | `#94a3b8` | `#57534e` |
| **Pending** | `warning` / alert orange | `#d97706` | `#fbbf24` | `#b45309` |
| **Packed** | `primary` / progress blue | `#1d4ed8` | `#60a5fa` | `#0f766e` |
| **Dispatched** | `success` / success green | `#059669` | `#34d399` | `#047857` |

Background tint cells (Bento boxes) use the `*Muted` variant of each token:

| Metric | Tint token |
|--------|-----------|
| Demand | `surfaceMuted` |
| Pending | `warningMuted` |
| Packed | `primaryMuted` |
| Dispatched | `successMuted` |

This ensures all four colours degrade gracefully in dark mode without custom overrides.

#### 1.2.2 Company card brand tint

Company cards receive a very subtle background tint derived from the brand's primary colour. Because brand colours are not stored in the data layer, the tint is generated deterministically from the first letter of the company name using a small fixed palette of 8 muted hues (opacity 6% over `surface`). This avoids network requests and remains readable in all themes.

---

### 1.3 Typography

All numbers in metric positions use `fontVariant: ['tabular-nums']` so columns align regardless of digit width.

#### 1.3.1 Weight hierarchy — Bento metric cell

| Layer | Role | Weight | Size |
|-------|------|--------|------|
| Primary | The number itself | **700** | 28 sp |
| Secondary | Abbreviated label below the number | 500 | 11 sp |
| Tertiary | Delta / change indicator (optional) | 400 | 10 sp |

#### 1.3.2 Progress & fill numbers

Fill Rate % inside progress bars: weight **600**, size 12 sp, monospaced.

#### 1.3.3 KPI Ribbon

Global ribbon stat number: weight **700**, size 20 sp, `textPrimary`.
Ribbon label: weight **400**, size 10 sp, `textMuted`.

---

## Section 2 — Component Breakdown

### 2.1 Dashboard — Sectioned Company Card (`CompanyCard`)

#### Current state
A flat list row with: logo · name · metrics summary string · last PO date · `StatusBadge`. All information is text-only. No depth, no fill visualisation.

#### Target design

```
┌──────────────────────────────────────────────────────┐
│  [Brand tint background — 6% opacity]                │
│  ┌──────┐  MYNTRA              Ack Pending: 3   [→]  │
│  │ Logo │  Open POs: 12        Expired: 1             │
│  └──────┘  Last PO: 28 Apr 2026                      │
│                                                      │
│  ████████████████████░░░░░░░░  72% Dispatched        │
│  ─────────────────────────────────────────────────── │
│  84 total demand                                     │
└──────────────────────────────────────────────────────┘
```

**Structure (top → bottom):**
1. **Header row** — 48 dp logo (rounded 8 dp), company name (`font.body`, weight 600), right-aligned `StatusBadge` and chevron.
2. **Metric row** — 4 inline chips: `Ack Pending`, `Open`, `Expired`, `Cancelled`. Each chip is `label` (10 sp muted) + `number` (13 sp, coloured by severity using the status token map).
3. **Progress row** — a single `LinearProgressBar` (height 8 dp, full pill radius). Fill colour: `success` for ≥ 80%, `warning` for 40–79%, `danger` for < 40%. Track colour: `surfaceMuted`. Right-aligned percentage label.
4. **Footer row** — `Last PO: DD Mon YYYY` in `textMuted`.

**Elevation:** `shadowOpacity: 0.06`, `shadowRadius: 8`, `elevation: 3` (Android).

**Touch feedback:** Scale from `1.0 → 0.98` on press-in via `Animated.spring` (replaces the current opacity flash). No functional change to navigation.

---

### 2.2 PO Card (`PoCard`)

#### Current state
A list row with a 3 dp left accent bar, inline PO number, company name, one metrics string (`N pend · N out · N% fill`), date line, and `StatusBadge`.

#### Target design
The list row is preserved for the **All POs** and **WIP POs** tabs (scan-heavy use). The accent bar is kept. Two changes:

1. **Metrics string → Mini Bento strip.** The single text line `pend · out · fill` is replaced with four small coloured pill-badges (Demand / Pending / Packed / Dispatched), each showing the number in the appropriate status colour. They sit in a horizontal row below the PO number line.
2. **Inline fill bar.** A thin (4 dp) progress bar replaces the `N% fill` text. The bar uses the same colour logic as the Company Card progress bar.

Grid variant is unchanged — it already uses tiles.

---

### 2.3 PO Detail Screen — Bento Box Metric Grid

#### Current state
The "Details" tab renders a `StatsGrid` with a generic key-value layout. The `items` tab has `SkuItemCard` with a `MetricRow` (horizontal label-value list).

#### Target design

**A. Header (Sticky)**

```
┌───────────────────────────────────────────────────────┐
│  [Logo 32dp]  PO-12345678  [WIP badge]  [OPEN badge]  │
│  Myntra  ·  Menswear  ·  Delhi                        │
└───────────────────────────────────────────────────────┘
```

The PO header is lifted into a `StickyHeader` component that remains visible while the user scrolls through items. It collapses from two lines to a single line (logo + PO number only) once the user scrolls more than 64 dp past the top. This is implemented with a scroll-event `Animated.Value`, clamped via `interpolate`. **No new library required.**

**B. 2×2 Bento Metric Grid (inside the Details tab)**

```
┌──────────────────┬──────────────────┐
│  DEMAND          │  PENDING         │
│  [surfaceMuted]  │  [warningMuted]  │
│                  │                  │
│  2 840           │  1 203           │
│  units           │  units           │
├──────────────────┼──────────────────┤
│  PACKED          │  DISPATCHED      │
│  [primaryMuted]  │  [successMuted]  │
│                  │                  │
│  912             │  725             │
│  units           │  units           │
└──────────────────┴──────────────────┘
```

Each cell:
- Background: muted tint (see §1.2.1)
- Label: 10 sp, weight 500, `textMuted`, uppercase, `letterSpacing: 0.8`
- Number: 28 sp, weight **700**, `tabular-nums`, state colour
- Unit: 10 sp, weight 400, `textSecondary`
- Corner radius: 16 dp (`radius.lg`)
- Internal padding: 16 dp
- Gap between cells: 8 dp

**C. SkuItemCard metric area**

The existing `MetricRow` (horizontal label-value list) inside `SkuItemCard` is replaced with a 4-cell **compact Bento row** — same colour-state logic, but cells are 16 dp tall pill-shaped tags rather than full squares. This keeps the card compact while introducing colour cues.

---

### 2.4 Global KPI Status Ribbon

#### Current state
The `PoJourneyScreen` shows a one-line summary strip (`Total Ack Pending · Open POs · Expired · Cancelled`). It is a plain styled `Text` node.

#### Target design

A horizontally scrollable `ScrollView` (horizontal, `showsHorizontalScrollIndicator: false`) pinned **below the search bar**, above the list. It contains 4–6 `KpiChip` components.

**KpiChip structure:**
```
┌───────────────────┐
│  blurred surface  │  ← iOS: BlurView (expo-blur / @react-native-community/blur)
│                   │     Android: `rgba` overlay (no blur dep required)
│  TOTAL POs        │  ← label, 10 sp muted
│  47               │  ← number, 20 sp bold, primary colour
└───────────────────┘
```

Width: fixed 84 dp per chip. Height: 60 dp. Corner radius: 12 dp.

**Scroll behaviour & z-index:**
- The ribbon is part of the list header (rendered as `ListHeaderComponent`), not a floating overlay. This keeps it naturally above the list cells without manual `zIndex` management.
- On iOS, if `@react-native-community/blur` is available, `BlurView` (intensity 20, tint: `light`/`dark`) is used for the chip background. If unavailable, a `rgba(255,255,255,0.72)` / `rgba(15,23,42,0.72)` fallback is used.
- The ribbon does **not** re-render on scroll events. It is a pure layout component.

---

### 2.5 Actionable Media Card (`ListingDetailScreen` + `ShareOptionsScreen`)

#### Current state
`ListingDetailScreen`: a vertical list of image URLs rendered as clickable cells. `ShareOptionsScreen`: three plain Pressable rows with arrow + label.

#### Target design

**Media Card layout:**

```
┌───────────────────────────────────────────┐
│                                           │
│              [Image 100% width]           │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  QTY REQUIRED: 48        [⬡ Share]  │  │  ← metadata overlay (bottom gradient)
│  └─────────────────────────────────────┘  │
├───────────────────────────────────────────┤
│  SKU ID  ·  C.C.P  ·  C.C.S              │
│                                           │
│  [📋 Copy URL]         [↗ Share Image]    │
│  [↗ Share with Qty]   [↗ Full Details]   │
└───────────────────────────────────────────┘
```

1. **Image area** — Full-width (screen width minus 32 dp). Aspect ratio 4:3. `resizeMode: "cover"`. Corner radius 12 dp. Image is sourced from `image_url`.
2. **Metadata overlay** — A `LinearGradient` from `transparent → rgba(0,0,0,0.65)` anchored to the bottom 40 dp of the image. Overlay text: `QTY REQUIRED: N` in white, weight 700, 14 sp. Right side: a small `Share` pill button (white, rounded).
3. **Quick action bar** (below the image card):
   - **Copy URL** — copies `image_url` to `Clipboard` (from `@react-native/clipboard` or the existing `react-native-blob-util` if clipboard is available). Shows a brief ✓ confirmation badge on the button for 1.5 s.
   - **Share Image** — triggers `Share.share({ message: imageUrl })`.
   - **Share with Qty** — triggers `Share.share({ message: 'SKU: {id} · QTY: {demand}\n{url}' })`.
   - **Full Details** — navigates to the existing `ListingDetailScreen` expanded view.
4. **Shareable URL system** — No server-side short-link service is proposed at this stage. URLs are passed as-is. A `generateSharePayload(row, mode)` pure function encapsulates the text-building logic (extracted from `ShareOptionsScreen.buildText`). This function can be extended to support short-link injection later without touching the UI.

---

## Section 3 — Technical Implementation Strategy

### 3.1 State Management

#### Real-time Fill Rate updates

When a box is added (`createConsignmentBox` succeeds), the following query keys must be invalidated:

```
['outbound', 'consignment', consignmentId, *]      // items, box list
['outbound', 'po', poId, *]                        // PO detail stats
['outbound', 'pos']                                // PO list cards
['outbound', 'companies']                          // company summary strip
```

This is handled by calling `queryClient.invalidateQueries` in the `onSuccess` callback of the box creation mutation. **No additional state manager** is introduced — TanStack Query's cache invalidation is sufficient.

#### Animated fill rate counter

When a Bento cell number changes due to a cache update, the numeric value is animated via `Animated.Value` interpolated from the previous value to the new value over 600 ms using `Animated.timing` with `Easing.out(Easing.cubic)`. The animation triggers only when the new value differs from the old. This is a pure presentation concern local to the metric cell component.

---

### 3.2 One-Handed Navigation — Bottom Sheet transition

#### Add New Box (`AddNewBoxScreen`)

| Current | Target |
|---------|--------|
| Full-screen `Screen` component, navigated via `navigation.navigate` | **Responsive Bottom Sheet** presented modally, occupying 70 % of screen height, expanding to 95 % when keyboard appears |
| Box name picker: centered `Modal` | Nested bottom sheet snap point or inline scrollable list within the same sheet |

**Implementation approach:**
- The bottom sheet is a `View` inside a `Modal` (`transparent`, `animationType: "slide"`). It uses `Animated.Value` to track drag position. A pan responder handles the drag-to-dismiss gesture.
- No third-party bottom sheet library is added. The existing `Modal`-based pattern in `AddNewBoxScreen` (currently used for the picker) is generalised into a reusable `BottomSheet` component in `shared/ui/`.
- **Thumb zone:** All primary inputs (box name selector, stepper) are placed in the bottom 55 % of the sheet. The SKU list scrolls within the upper portion. This follows the iOS Human Interface Guideline "reachability zone" (≤ 330 dp from screen bottom for 375 dp screen width).

#### Haptic feedback trigger points

| Event | Haptic pattern |
|-------|---------------|
| Box successfully created | `HapticFeedback.trigger('notificationSuccess')` |
| Box creation error | `HapticFeedback.trigger('notificationError')` |
| SKU selection toggled | `HapticFeedback.trigger('impactLight')` |
| Stepper increment / decrement | `HapticFeedback.trigger('selection')` |

Implementation uses `react-native`'s built-in `Vibration` API as a zero-dependency fallback, or the `react-native-haptic-feedback` package if already present. The exact package choice is deferred to implementation review.

#### Fill Rate micro-animation

The `FillRateBar` component already exists (`shared/ui/FillRateBar.tsx`). The target enhancement is:
- On mount or value change, the bar width animates from 0 → target width using `Animated.timing` (500 ms, `Easing.out(Easing.exp)`).
- The percentage label counts up from 0 to the target integer value using a `setInterval` over 500 ms, updating every 33 ms (≈ 30 fps). This creates the "scoreboard" counter effect.

---

### 3.3 Sharing Logic

A new pure utility `outboundShareService.ts` (in `features/outbound/`) encapsulates all share payload construction:

```
generateSharePayload(rows, mode, context) → { message: string, title: string }
```

- `mode`: `'full' | 'images' | 'qty' | 'single'`
- `context`: `{ poNumber?, consignmentId?, skuIds? }`
- Returns a typed payload ready to pass to `Share.share()`.

**Copy-to-clipboard flow:**
1. User taps "Copy URL" on a media card.
2. `Clipboard.setString(imageUrl)` is called.
3. The button transitions to a "✓ Copied" state for 1.5 s via a `useState` boolean, then reverts.
4. A `HapticFeedback.trigger('impactLight')` fires on copy.

No server-side short-link service is implemented in this phase.

---

## Section 4 — Proposed User Flow

### 4.1 Full journey map

```
[Search / Home]
      │
      ▼
[KPI Ribbon renders] ──────── micro: ribbon chips fade in (150 ms, stagger 40 ms each)
      │
      ▼
[Select Retailer — Company Card]
      │  press-in: card scale 1.0 → 0.98 (spring 80 ms)
      ▼
[PO List for Retailer]
      │  PO cards show Mini Bento strip with colour states
      ▼
[Select PO — PO Detail Screen]
      │  sticky header collapses on scroll > 64 dp
      ▼
  ┌───────────────────────────────────┐
  │  Tabs: Items · Consignments · Details · Logs   │
  └───────────────────────────────────┘
      │
      ├──[Items tab]─────────────────────────────────────────────────────────────┐
      │      SkuItemCard with compact Bento metric row                           │
      │      Tap card → ListingDetailScreen                                      │
      │           Media card renders (image + metadata overlay)                  │
      │           Quick actions: Copy URL · Share Image · Share with Qty         │
      │           Tap "Share Image" → ShareOptionsScreen bottom sheet            │
      │                                                                          │
      ├──[Details tab]───────────────────────────────────────────────────────────┤
      │      2×2 Bento metric grid                                               │
      │      On load: numbers count up from 0 → value (600 ms, cubic easing)    │
      │                                                                          │
      ├──[Consignments tab]──────────────────────────────────────────────────────┤
      │      Tap consignment → OutboundConsignmentDetailScreen                   │
      │           "View Consignment Items" → ConsignmentItemsScreen              │
      │                Select SKUs (checkboxes, haptic on toggle)                │
      │                                                                          │
      │                Action bar: [Add to Box]                                  │
      │                      ↓                                                   │
      │                AddNewBox — Bottom Sheet slides up (350 ms spring)        │
      │                      ↓  fill box name + quantities                       │
      │                [Confirm]                                                 │
      │                      ↓                                                   │
      │                createConsignmentBox API call                             │
      │                      ↓ success                                           │
      │                haptic: notificationSuccess                               │
      │                sheet dismisses (slide down 250 ms)                      │
      │                TanStack Query invalidation fires                         │
      │                      ↓                                                   │
      │                FillRateBar animates 0 → new% (500 ms)                   │
      │                Bento number counter increments (600 ms)                 │
      │                                                                          │
      └──[Logs tab]──────────────────────────────────────────────────────────────┘
              PoLogCard list (no visual change in this phase)
```

### 4.2 Animation summary table

| Trigger | Component | Animation | Duration | Easing |
|---------|-----------|-----------|----------|--------|
| Screen mount | KPI Ribbon chips | opacity 0 → 1, translateY 8 → 0, staggered | 150 ms + 40 ms/chip | `easeOut` |
| Card press-in | Company Card, PO Card | scale 1.0 → 0.98 | 80 ms | `spring` |
| Scroll > 64 dp | Sticky PO header | height + opacity collapse | 200 ms | `easeInOut` |
| Data load | Bento metric numbers | count-up from 0 | 600 ms | `cubicOut` |
| Data load | FillRateBar | width 0 → target | 500 ms | `expOut` |
| Box added | FillRateBar | re-animate from previous → new % | 500 ms | `expOut` |
| Bottom sheet open | AddNewBox sheet | translateY screen → 30% | 350 ms | `spring k=80 d=15` |
| Bottom sheet close | AddNewBox sheet | translateY 30% → screen | 250 ms | `easeIn` |
| Copy URL | Copy button | label swap + checkmark fade | 150 ms | `easeOut` |

---

## Summary of Delta vs Current Code

| File | Change type | Summary |
|------|------------|---------|
| `shared/ui/theme.ts` | Extend | Add `radius.lg = 16`, `radius.xl = 20` |
| `shared/theme/palettes.ts` | No change | All new tokens map to existing keys |
| `shared/ui/FillRateBar.tsx` | Enhance | Add mount/update animation |
| `shared/ui/BottomSheet.tsx` | **New** | Reusable animated bottom sheet |
| `features/outbound/components/CompanyCard.tsx` | Redesign | Brand tint, progress bar, new layout |
| `features/outbound/components/PoCard.tsx` | Enhance | Mini bento strip, fill bar |
| `features/outbound/components/SkuItemCard.tsx` | Enhance | Compact bento metric row |
| `features/outbound/components/KpiRibbon.tsx` | **New** | Glassmorphism status ribbon |
| `features/outbound/components/BentoMetricGrid.tsx` | **New** | 2×2 animated grid |
| `features/outbound/components/MediaCard.tsx` | **New** | Image + overlay + quick actions |
| `features/outbound/components/StickyPoHeader.tsx` | **New** | Collapsing sticky header |
| `features/outbound/AddNewBoxScreen.tsx` | Refactor | Wrap in `BottomSheet`, thumb-zone layout |
| `features/outbound/ShareOptionsScreen.tsx` | Refactor | MediaCard integration, Copy URL |
| `features/outbound/outboundShareService.ts` | **New** | Pure share payload builder |
| `PoJourneyScreen.tsx` | Enhance | Mount `KpiRibbon` as `ListHeaderComponent` |
| `PoDetailScreen.tsx` | Enhance | Mount `StickyPoHeader`, `BentoMetricGrid` in Details tab |

**New library dependencies required:** none confirmed. `@react-native-community/blur` is optional (graceful fallback exists). Haptic feedback uses RN `Vibration` or an existing package.

---

*Awaiting your review. Please annotate any sections you want modified before implementation begins.*
