# Left Sidebar Navigation Plan

## Summary

Move ALL navigation (top-bar menus + module sub-nav bars) into an **always-visible left sidebar** on desktop. The top bar becomes minimal (logo + avatar). Horizontal sub-nav bars are removed entirely — the sidebar is the single navigation source. On mobile (< 768px), the sidebar becomes a left overlay triggered by a hamburger.

---

## Current State

```
┌───────────────────────────────────────────────────────────────────┐
│ [☰] eCraft Zap  [Products▾] [Inbound▾] [Outbound▾] [W&O▾] [T▾] [🌙][👤] │
├───────────────────────────────────────────────────────────────────┤
│ ██████ Sub-nav bar (colored tabs: Vendors | POs | GRNs | ...) ██ │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│                     Page content                                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

Problems:
- Top bar clips on narrow screens
- Sub-nav duplicates items already in the top-bar dropdowns
- Two layers of navigation (top + sub-nav) compete for attention
- 44px of vertical space lost to the colored bar

---

## Proposed Layout

### Desktop (>= 768px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  eCraft Zap                                           [🌙] [👤 avatar ▾] │
├───────────────────────┬──────────────────────────────────────────────────┤
│                       │                                                  │
│   LEFT SIDEBAR        │                                                  │
│                       │              Page content                        │
│   ┌─────────────────┐ │              (full width, full vertical space)   │
│   │ ▸ Products      │ │                                                  │
│   │ ▸ Inbound       │ │              No sub-nav bar above content.       │
│   │ ▾ Outbound      │ │              Sidebar IS the navigation.          │
│   │   ORDERS        │ │                                                  │
│   │   ┃ All POs     │ │                                                  │
│   │     WIP POs     │ │                                                  │
│   │     Partial     │ │                                                  │
│   │     New PO      │ │                                                  │
│   │   FULFILLMENT   │ │                                                  │
│   │     Consign.    │ │                                                  │
│   │     Boxes       │ │                                                  │
│   │     Pend. Inv.  │ │                                                  │
│   │   DATA          │ │                                                  │
│   │     EAN Map     │ │                                                  │
│   │ ▸ Warehouse&Ops │ │                                                  │
│   │ ▸ Tools         │ │                                                  │
│   └─────────────────┘ │                                                  │
│                       │                                                  │
└───────────────────────┴──────────────────────────────────────────────────┘
```

### Mobile (< 768px)

```
┌─────────────────────────────────────┐
│ [☰] eCraft Zap          [🌙] [👤]  │
├─────────────────────────────────────┤
│                                     │
│          Page content               │
│          (full screen)              │
│                                     │
└─────────────────────────────────────┘

Hamburger [☰] opens sidebar as LEFT sheet overlay (same content as desktop).
```

---

## Sidebar Visual Design

Width: **240px** fixed on desktop.

### Color Coding

| Element                     | Color                                                          | Purpose               |
|-----------------------------|----------------------------------------------------------------|------------------------|
| Sidebar background          | `bg-card` (same as header)                                     | Blends with chrome     |
| Sidebar border              | `border-r border-border`                                       | Separates from content |
| Group header (collapsed)    | `text-foreground font-semibold text-sm`                        | Clear section label    |
| Group header (active group) | `text-primary font-semibold`                                   | Shows current domain   |
| Group chevron               | `text-muted-foreground` (rotates 90deg when open)              | Toggle indicator       |
| Section title               | `text-muted-foreground text-xs uppercase tracking-wider`       | Subtle category label  |
| Nav item (default)          | `text-muted-foreground hover:bg-muted hover:text-foreground`   | Standard link          |
| Nav item (active page)      | `bg-primary/10 text-primary font-medium border-l-2 border-primary` | Current page highlight |
| Admin-only items            | Same as above (only rendered when `isAdmin === true`)          | No visual distinction  |

### Active State Rendering (example: on /outbound page)

```
▸ Products                    ← text-foreground (collapsed)
▸ Inbound                     ← text-foreground (collapsed)
▾ Outbound                    ← text-primary font-semibold (active group, expanded)
  ORDERS                      ← text-muted-foreground text-xs uppercase
  ┃ All Purchase Orders       ← bg-primary/10 text-primary border-l-2 border-primary (ACTIVE)
    WIP Purchase Orders       ← text-muted-foreground
    Partially Created         ← text-muted-foreground
    Add New PO                ← text-muted-foreground
  FULFILLMENT                 ← text-muted-foreground text-xs uppercase
    Consignments              ← text-muted-foreground
    Manage Boxes              ← text-muted-foreground
    Pending Invoices          ← text-muted-foreground
  DATA                        ← text-muted-foreground text-xs uppercase
    SKU / EAN Mappings        ← text-muted-foreground
▸ Warehouse & Ops             ← text-foreground (collapsed)
▸ Tools                       ← text-foreground (collapsed)
```

### Active State Rendering (example: on /inbound/pending-audits page)

```
▸ Products                    ← text-foreground (collapsed)
▾ Inbound                     ← text-primary font-semibold (active group, expanded)
  CORE                        ← text-muted-foreground text-xs uppercase
    Vendor Directory          ← text-muted-foreground
    Vendors                   ← text-muted-foreground
    Purchase Orders           ← text-muted-foreground
    SKU Wise View             ← text-muted-foreground
    All GRNs                  ← text-muted-foreground
  QUEUES                      ← text-muted-foreground text-xs uppercase
  ┃ Pending Audits            ← bg-primary/10 text-primary border-l-2 border-primary (ACTIVE)
    Pending Invoice Coll.     ← text-muted-foreground
    Pending Accounts          ← text-muted-foreground
    Pending Debit & Credit    ← text-muted-foreground
  FLOWS                       ← text-muted-foreground text-xs uppercase
    Inbound Flows             ← text-muted-foreground
▸ Outbound                    ← text-foreground (collapsed)
▸ Warehouse & Ops             ← text-foreground (collapsed)
▸ Tools                       ← text-foreground (collapsed)
```

---

## Top Bar (Simplified)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [☰ mobile only]  eCraft Zap                          [ThemeToggle] [👤▾] │
└──────────────────────────────────────────────────────────────────────────┘
```

- No navigation links in the top bar
- Avatar dropdown: email, roles, Sign out
- Admin links (User management, EAN mappings) move to sidebar "Tools → Admin" section
- Hamburger only shows on mobile (< md)

---

## Sidebar Behavior

| Aspect              | Desktop (>= 768px)                    | Mobile (< 768px)                     |
|---------------------|----------------------------------------|---------------------------------------|
| Visibility          | Always visible, pinned on left         | Hidden; opens via hamburger (☰)       |
| Width               | 240px fixed                            | 280px overlay (Sheet from left)       |
| Scrolling           | Sidebar scrolls independently (ScrollArea) | Same                             |
| Collapse/expand     | Click group header to toggle           | Same                                  |
| Active group        | Auto-expanded based on current URL     | Same                                  |
| Multi-open          | Multiple groups can be open at once    | Same                                  |
| Navigation          | Click item → navigates, sidebar stays  | Click item → navigates, sheet closes  |
| Admin items         | Shown only if `isAdmin === true`       | Same                                  |

---

## Data Source

Reuse the existing `navGroups` array from `web/src/lib/nav-groups.ts`. No changes to the data model — it already contains all items including what the sub-navs used to show.

---

## Files to Change

| File                                                | Change                                              |
|-----------------------------------------------------|------------------------------------------------------|
| `web/src/components/layout/app-shell.tsx`           | Remove DesktopNav. Add flex layout with left sidebar `<aside>` + content area. Mobile sheet from left. Remove sub-nav rendering from flow. |
| `web/src/components/layout/app-sidebar.tsx`         | **NEW** — the sidebar component (accordion groups, sections, items, active state, scroll) |
| `web/src/components/layout/nav-group-dropdown.tsx`  | DELETE (no longer used)                             |
| `web/src/components/layout/mobile-nav-accordion.tsx`| DELETE (sidebar component replaces it)              |
| `web/src/hooks/use-overflow-nav.ts`                 | DELETE (no overflow logic needed)                   |
| `web/src/components/layout/inbound-sub-nav.tsx`     | DELETE (merged into sidebar)                        |
| `web/src/components/layout/bins-sub-nav.tsx`        | DELETE (merged into sidebar)                        |
| `web/src/components/layout/listing-sub-nav.tsx`     | DELETE (merged into sidebar)                        |
| `web/src/components/layout/outbound-sub-nav.tsx`    | DELETE (merged into sidebar)                        |
| `web/src/components/layout/outbound-po-sub-nav.tsx` | DELETE (merged into sidebar)                        |
| `web/src/components/layout/catalogues-sub-nav.tsx`  | DELETE (merged into sidebar)                        |
| `web/src/components/layout/ops-sub-nav.tsx`         | Already deleted                                     |
| `web/src/app/(app)/bins/layout.tsx`                 | Remove BinsSubNav import, simplify to just `<AppPageShell>` |
| `web/src/app/(app)/(logistics)/inbound/layout.tsx`  | Remove InboundSubNav import                        |
| `web/src/app/(app)/(logistics)/outbound/layout.tsx` | Remove OutboundSubNav import                       |
| `web/src/app/(app)/listings/layout.tsx`             | Remove ListingSubNav import                        |
| `web/src/app/(app)/catalogues/layout.tsx`           | Remove CataloguesSubNav import                     |

---

## Component Structure

```
AppShell
├── <header> (top bar: logo + theme + avatar)
│
├── <div className="flex flex-1 overflow-hidden">
│   │
│   ├── <aside className="hidden md:flex w-60 border-r flex-col">  ← LEFT SIDEBAR (desktop)
│   │   └── <ScrollArea>
│   │       └── <AppSidebar />
│   │           ├── NavGroup "Products" (collapsible)
│   │           ├── NavGroup "Inbound" (collapsible)
│   │           ├── NavGroup "Outbound" (collapsible)
│   │           ├── NavGroup "Warehouse & Ops" (collapsible)
│   │           └── NavGroup "Tools" (collapsible, admin-filtered)
│   │
│   └── <main className="flex-1 min-w-0 overflow-y-auto">
│       └── [Page content directly — no sub-nav bar]
│
└── <footer>
```

Mobile: `<Sheet side="left">` wraps the same `<AppSidebar />`.

---

## Interaction Details

1. **Page load**: The group matching the current URL auto-expands. Other groups stay collapsed.
2. **Click group header**: Toggles that group open/closed. Multiple groups can be open at the same time.
3. **Click nav item**: Navigates to that route. Sidebar stays visible (desktop) or closes (mobile sheet).
4. **Active item**: The item matching the current pathname gets highlighted styling (`bg-primary/10 text-primary font-medium border-l-2 border-primary`).
5. **Active group header**: The parent group of the active item gets `text-primary font-semibold` (instead of default `text-foreground`).
6. **Admin filtering**: Items with `adminOnly: true` hidden for non-admin users. Sections with zero visible items are hidden entirely.
7. **Scroll preservation**: Sidebar scroll position persists across navigations (it doesn't re-mount on route change since AppShell is a layout component).

---

## No Commits

This is a plan document only. Implementation will happen after explicit approval.
