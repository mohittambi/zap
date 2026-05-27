# Consignment line items — post-RTD tab views (implementation plan)

**Status:** Implemented  
**Target:** Consignment detail (`/outbound/consignments/[id]`)

## Goal

After a consignment is marked for dispatch (and any forward lifecycle state), replace the editable packing editor with **four read-only tabbed tables** matching the reference app screenshots, plus **Download Current View** (CSV) per active tab.

## Gating (when to show tabs vs editor)

| Mode | Condition | UI |
|------|-----------|-----|
| **Editable** | `marked_rtd_at` is null **and** `consignment_status` ≠ `MARKED_RTD` (case-insensitive) | Existing `ConsignmentLineItemsEditor` |
| **Locked / views** | `marked_rtd_at` set **or** status is `MARKED_RTD` | New `ConsignmentLineItemsTabViews` |

Rationale: sync may use status variants; `marked_rtd_at` is the reliable “forward” anchor.

## Data source

- Table: `outbound_consignment_items` (one row per box line).
- **Do not** reuse `GET /api/outbound/consignments/[id]/items` — it aggregates by SKU for mobile packing.
- **New:** `GET /api/outbound/consignments/[id]/line-items/rows` — flat rows, ordered by `box_number`, `id`.

### Flat row fields (API)

| Field | DB column | Used in |
|-------|-----------|---------|
| PO Secondary SKU | `po_secondary_sku` | All views |
| Company Code Primary | `company_code_primary` | All views |
| Company Code Secondary | `company_code_secondary` | PO Wise |
| Box Number | `box_number` | Default, Box, SKU, PO |
| Box Quantity | `box_quantity` | Default, Box, SKU, PO |
| Box Name | `box_name` | Default |
| Submitted From | `submitted_from` | Default |
| Created By | `created_by` | Default |
| Created At | `created_at_ea` | Default |
| Updated At | `updated_at_ea` | Default |
| MRP | `mrp` | PO Wise |
| Original Demand | `original_demand` | PO Wise |
| Dispatched Quantity | `dispatched_quantity` | PO Wise |
| Consignment Quantity | `consignment_quantity` | PO Wise |
| Overall Fill Rate | `overall_fill_rate` | PO Wise |

## Four views (client aggregation)

Implemented in `web/src/lib/outbound-consignment-line-views.ts`.

### 1. Default View

- One table row per flat DB row.
- Columns: Sr. No, PO Secondary SKU, Company Code Primary, Box Number, Box Quantity, Box Name, Submitted From, Created By, Created At, Updated At.
- Sr. No = 1-based index in sort order.

### 2. Box Wise View

- Group by `box_number`.
- Columns: Box Number, Total Box Quantity, PO Secondary SKUs in Box, Company Codes Primary in Box.
- Aggregates: `SUM(box_quantity)`; distinct SKUs/codes joined with `", "`.

### 3. SKU Wise View

- Group by `po_secondary_sku` (+ primary code for display).
- Columns: PO Secondary SKU, Company Code Primary, Total Quantity, Box Numbers.
- Total Quantity = `SUM(box_quantity)`; Box Numbers = sorted distinct `box_number` joined.

### 4. PO Wise View

- One row per SKU (same grouping as SKU Wise).
- Columns: PO Secondary SKU, Company Code Primary, Company Code Secondary, MRP, Original Demand, Dispatched Quantity, Consignment Quantity, Box Numbers, Overall Fill Rate %.
- Scalars: `MAX` per group where multiple lines exist; fill rate from DB or `(consignment_quantity / original_demand) * 100`.

## UI component

**File:** `web/src/components/outbound/consignment-line-items-tab-views.tsx`

- Card wrapper, title “Consignment line items”.
- `@/components/ui/tabs` — tabs: Default View | Box Wise View | SKU Wise View | PO Wise View (styled like PO detail tabs).
- Toolbar row: **Download Current View** (outline button, right-aligned) — exports active tab as `.csv`.
- Scrollable HTML table per tab.
- Loading / empty states.
- Fetch rows on mount via new API.

## Integration

**File:** `consignment-detail-client.tsx`

```tsx
{linesLocked ? (
  <ConsignmentLineItemsTabViews consignmentId={Number(id)} />
) : (
  <ConsignmentLineItemsEditor ... />
)}
```

`linesLocked` helper exported or inlined.

## Server

- `listConsignmentLineItemRowsFlat(consignmentId)` in `outboundConsignmentItemsService.ts`.
- Route: `web/src/app/api/outbound/consignments/[id]/line-items/rows/route.ts` — `purchase_orders:read`.

## Save guard (existing)

`saveConsignmentLineItems` already rejects when `marked_rtd` — no change required.

## Tests

- `web/tests/unit/outbound-consignment-line-views.test.ts` — aggregation for box/sku/po views, CSV header rows.

## Docs

- Update `outbound-tab-process-notes.md` §VI–VII with post-RTD tab views.
- Update `api.md` with new route.

## Out of scope (v1)

- Server-side `view=` query param (client aggregation sufficient for typical consignment sizes).
- Pagination on tab tables (load all rows up to practical limit; API returns full set).
- Purple eAutomate theme pixel-match (use existing Zap tabs styling).

## File checklist

| # | File | Action |
|---|------|--------|
| 1 | `lib/outbound-consignment-line-views.ts` | Create |
| 2 | `outboundConsignmentItemsService.ts` | Add flat list fn |
| 3 | `api/.../line-items/rows/route.ts` | Create |
| 4 | `consignment-line-items-tab-views.tsx` | Create |
| 5 | `consignment-detail-client.tsx` | Wire gating |
| 6 | `outbound-consignment-line-views.test.ts` | Create |
| 7 | `outbound-tab-process-notes.md`, `api.md` | Update |
