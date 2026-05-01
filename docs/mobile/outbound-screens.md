# Mobile App — Outbound Module: Current Screens & Required Changes

> **Basis:** Screenshots of the reference app (recorded ~4:47–4:49) compared against the React Native codebase at `mobile/src/features/outbound/`.

---

## 1. Current State — Implemented Screens

### 1.1 Purchase Order Journey (`PoJourneyScreen.tsx`)

Entry via **Outbound Home → Purchase Orders**. Three-tab bottom bar:

| Tab | What it shows |
|-----|---------------|
| **All Companies** | Paginated company list with directory summary strip (Total Ack Pending, Open POs, Expired, Cancelled). Tapping a company drills into that company's PO list. Search supported. |
| **All POs** | Paginated PO list across all companies. Search supported. |
| **WIP POs** | Paginated PO list filtered to WIP=true. Search supported. |

**Company card** shows: company logo, name, Acknowledgement Pending, Open POs, Expired POs, Cancelled POs, Last PO Added At.

**PO card** shows: company logo, PO number, PO type, location, PO Release date, PO Expiry date, PO Added date, SKU Count, SKU Fill Rate %, QTY Fill Rate %, DEMAND / PENDING / PACKED / DISPATCHED counters, WIP badge, status badge (OPEN / EXPIRED / CANCELLED).

---

### 1.2 PO Detail Screen (`PoDetailScreen.tsx`)

Four-tab bottom bar. Header shows company logo, PO number, PO type, WIP badge, status.

| Tab key | Label | What it shows |
|---------|-------|---------------|
| `items` | **All Items** | Paginated SKU list. Each `SkuItemCard` shows image, SKU ID, C.C.P, C.C.S, SKU Type chip, Warehouse Inventory chip, Fill Rate bar, Demand / Pending / Packed / Dispatched metrics. |
| `consignments` | **PO Consignments** | Paginated consignment cards with: Consignment ID, status, Boxes, SKUs, Total Qty, Invoice #, Transporter, Created By, Created At. Tapping navigates to Consignment Detail. |
| `details` | **PO Details** | Statistics grid (Number of SKUs, SKU Fill Rate %, Total Demand, QTY Fill Rate %, Total Pending, Total Consignments, Total Packed, Total Dispatched, Boxes Packed, Boxes Dispatched, PO Value before/after tax) + details table (Sold Via, Reference Location, Delivery Address, Billing Address, Buyer GSTIN, PO Release/Expiry dates). |
| `logs` | **PO Logs** | Flat log entry list via `PoLogCard`. |

---

### 1.3 Consignment Detail Screen (`OutboundConsignmentDetailScreen.tsx`)

Reached from the **PO Consignments** tab or the global **Consignments** list.

Shows a plain key-value card with 19 fields:
`id`, `po_number`, `company_name`, `location`, `sold_via`, `po_type`, `consignment_status`, `invoice_number_status`, `invoice_number`, `invoice_upload_status`, `boxes_count`, `sku_count`, `total_quantity`, `transporter_name`, `vehicle_number`, `docket_number`, `created_at`, `marked_rtd_at`, `marked_rtd_by`.

> **Note:** This is a read-only metadata view. The reference app shows a much richer interactive screen here — see §3.1.

---

### 1.4 Global Consignments List (`OutboundConsignmentsScreen.tsx`)

Standalone paginated list of all consignments (not scoped to a PO). Search bar. List/grid layout toggle. Navigates to Consignment Detail on tap.

Also provides **OutboundPendingInvoicesScreen** (same component, `pendingInvoice=true` filter).

---

### 1.5 Outbound Home (`OutboundHomeScreen.tsx`)

Landing screen. Buttons linking to:
- Purchase Orders (journey)
- Add new purchase order *(placeholder)*
- Partially created purchase orders
- Consignments
- Pending invoices
- Manage boxes *(placeholder)*

---

### 1.6 Outbound PO List (`OutboundPoListScreen.tsx`)

Accessed directly from Home (not via journey). WIP toggle switch. List/grid layout toggle. Count line showing loaded vs. total.

---

## 2. Repository Coverage

| API endpoint called | Purpose | Implemented |
|--------------------|---------|-------------|
| `GET outbound/companies` | Companies directory | ✅ |
| `GET outbound/purchase-orders` | PO list (all / WIP / partial / by company) | ✅ |
| `GET outbound/purchase-orders/:id/items` | SKU items for a PO | ✅ |
| `GET outbound/purchase-orders/:id/consignments` | Consignments for a PO | ✅ |
| `GET outbound/purchase-orders/:id/detail` | PO stats + address fields | ✅ |
| `GET outbound/purchase-orders/:id/logs` | PO log entries | ✅ |
| `GET outbound/consignments` | Global consignment list | ✅ |
| `GET outbound/consignments/:id` | Single consignment metadata | ✅ |
| `GET outbound/consignments/:id/items` | Items packed in a consignment | ❌ Missing |
| `GET outbound/consignments/:id/logs` | Consignment-level log entries | ❌ Missing |
| `POST outbound/consignments/:id/boxes` | Add a new box to a consignment | ❌ Missing |
| `GET outbound/box-sizes` (or similar) | Available box size options | ❌ Missing |
| Share / image generation | Image + text share of PO listings | ❌ Missing |

---

## 3. Required Changes — Missing Screens

---

### 3.1 Consignment Items Screen (interactive packing view)

**Priority: High** — replaces the current flat key-value `OutboundConsignmentDetailScreen`.

**What the reference app shows:**

```
┌─────────────────────────────────────┐
│ ← Consignment Items              ✓ │  ← header (save/confirm action)
│                                     │
│  Myntra                             │
│  PO Number : MYNJ-ELSP060426-2      │
│  ⏱ VIEW CONSIGNMENT LOGS           │
│                                     │
│  Consignment Id : 6537    OPEN      │
│  Boxes Count : 0     Created At:... │
│  SKU Count : 0       Created By:... │
│  Total Quantity : 0  Marked RTD: NA │
│  Invoice Number Status:             │
│  Invoice Number:                    │
│  Transporter:                       │
│─────────────────────────────────────│
│ ○ Select All    ADD TO BOX   SHARE  │  ← action bar (visible when ≥1 selected)
│                                     │
│ ┌──────────────────────────────┐ ✓  │  ← checkbox (blue when selected)
│ │ [img] CPFS162_BLK            │    │
│ │       C.C.P: ECIAPTFM...     │    │
│ │       C.C.S: 12516836        │    │
│ │ SKU TYPE  WAREHOUSE INV  FILL RATE% │
│ │ SINGLE    0              0.0%   │  │  ← FILL RATE highlighted purple/green
│ │ DEMAND  PENDING  PACKED  DISPATCHED │
│ │  22       22       0        0   │  │
│ └──────────────────────────────┘    │
└─────────────────────────────────────┘
```

**State after packing (fill rate = 100%):**

- Fill Rate cell turns **green**, shows `100.0 %`
- PENDING drops to 0, PACKED equals DEMAND
- "Listings Refreshed!" toast shown
- PO card in PO List reflects updated SKU Fill Rate and QTY Fill Rate

**New file:** `mobile/src/features/outbound/ConsignmentItemsScreen.tsx`

**Data needed:**
- Consignment header: existing `GET outbound/consignments/:id`
- Items list: **new** `GET outbound/consignments/:id/items` (paginated)
- Logs button: navigate to consignment logs screen

**New navigation route:** `OutboundConsignmentItems` with params `{ consignmentId: string, poNumber?: string }`

**Component changes required:**
- `SkuItemCard` — add optional `selectable: boolean` prop and `selected: boolean` prop to render checkbox overlay
- `OutboundConsignmentDetailScreen` — either replace with new screen or make it navigate to `ConsignmentItemsScreen`
- `outbound.repository.ts` — add `fetchConsignmentItemsPage(api, consignmentId, params)`
- Navigation types — add `OutboundConsignmentItems` to `OutboundStackParamList`

---

### 3.2 Add New Box / Packing Screen

**Priority: High** — core warehouse packing workflow, currently a placeholder.

**What the reference app shows:**

```
┌───────────────────────────────────┐
│ ←   Add New Box           ✕   ✓  │
│                                   │
│  Box Number : 1                   │
│  PO Number : MYNJ-ELSP060426-2    │
│  Consignment Id : 6537            │
│  SKU Count : 1                    │
│                                   │
│  Select Box Size                  │
│  ┌─────────────────────────────┐  │
│  │ Select Box Name..           │  │  ← dropdown
│  └─────────────────────────────┘  │
│  Options: 4_NO_BOX, FOUNTAIN_BOX, │
│           MASTER_BOX_1,           │
│           MASTER_BOX_2,           │
│           MASTER_BOX_3            │
│                                   │
│  CPFS162_BLK                      │
│  C.C.P: ECIAPTFM43634768          │
│  [img]  DEMAND  PENDING           │
│          22      22               │
│         PACKED  DISPATCHED        │
│          0       0                │
│         [−] [  0  ] [+]           │  ← quantity stepper (tap to type, +/- buttons)
│                                   │
│  ┌─────────────────────────────┐  │
│  │ Are you sure you want to    │  │
│  │ add new box?                │  │  ← confirmation dialog on save
│  │ CPFS162_BLK : 4             │  │
│  │         Yes       No        │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**Behaviour:**
- Box Number auto-increments per consignment (Box 1, Box 2, … Box 6, …)
- Box size dropdown fetches available options from API
- Each item shows its real-time DEMAND / PENDING / PACKED / DISPATCHED (from consignment items data)
- Quantity stepper defaults can be changed via Default Settings (§3.4)
- On ✓ (confirm header icon): show confirmation dialog listing each SKU and quantity
- On "Yes": `POST outbound/consignments/:id/boxes` with `{ box_name, items: [{ sku_id, quantity }] }`
- After success: navigate back to Consignment Items Screen, refresh items list, show "Listings Refreshed!" toast

**New file:** `mobile/src/features/outbound/AddNewBoxScreen.tsx`

**New navigation route:** `OutboundAddBox` with params:
```ts
{
  consignmentId: string;
  poNumber: string;
  poId: string;
  existingBoxCount: number;
}
```

**Repository additions:**
- `fetchBoxSizes(api)` — `GET outbound/box-sizes` or similar
- `createConsignmentBox(api, consignmentId, payload)` — `POST outbound/consignments/:id/boxes`

---

### 3.3 Listing Details Screen (SKU within PO context)

**Priority: Medium** — product detail view reached from tapping a SKU in the All Items tab.

**What the reference app shows:**

```
┌─────────────────────────────────┐
│ ←  Listing Details              │
│                                 │
│   [product image — large]       │
│   (collage frames: 4x6, 5x7)    │
│                                 │
│  [thumb1●] [thumb2] [thumb3]    │  ← image carousel
│                                 │
│  ⏱ VIEW LISTING LOGS            │
│                                 │
│  ┌── LISTING SUMMARY ─────────┐ │
│  │ PO Number       MYNJ-...   │ │
│  │ PO Secondary SKU CPFS162_BLK│ │
│  │ Master SKU      CPFS162_BLK │ │
│  │ Inventory SKU ID CPFS162_BLK│ │
│  │ Pack Combo SKU ID NA        │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**New file:** `mobile/src/features/outbound/ListingDetailScreen.tsx`

**New navigation route:** `OutboundListingDetail` with params `{ skuId: string, poNumber?: string, poId?: string }`

**Data needed:**
- `GET outbound/purchase-orders/:id/items/:skuId` (or listings endpoint with PO context)
- Image gallery URLs from listing data
- Listing logs: navigate to a logs screen or bottom-sheet

**Component changes required:**
- `SkuItemCard` — add `onPress` prop (currently no press handler)
- `ItemsTab` in `PoDetailScreen.tsx` — pass `onPress` to each `SkuItemCard` navigating to `OutboundListingDetail`

---

### 3.4 Default Settings Screen

**Priority: Medium** — configures packing defaults used in Add New Box.

**What the reference app shows:**

```
┌───────────────────────────────────┐
│ ←   Default Settings      Apply ✓ │
│                                   │
│  Order Default    [ 1 ]           │  ← numeric input
│  +/− counter      [ 1 ]           │  ← step size for stepper
│                                   │
│  CPFS162_BLK                      │
│  Available quantity : 0           │
│  Quantity Required : [−] [022] [+]│
│  DEMAND  PENDING  PACKED  DISPATCHED│
│   22      22       0       0      │
│                                   │
│  ┌──────────────────────────────┐ │
│  │ Do you wish to share text    │ │
│  │ instead?                     │ │  ← dialog when share triggered
│  │      Yes         No          │ │
│  └──────────────────────────────┘ │
└───────────────────────────────────┘
```

**Behaviour:**
- **Order Default**: pre-fills quantity for each new box item (default 1)
- **+/− counter**: step increment for the quantity stepper (default 1)
- **Quantity Required** per item: override for that specific item
- Settings persisted locally (AsyncStorage) and applied when opening Add New Box
- "Apply" button validates and saves; navigates back

**New file:** `mobile/src/features/outbound/PackingSettingsScreen.tsx`

**New navigation route:** `OutboundPackingSettings` (no params; reads current consignment context from a store/context)

---

### 3.5 Share Options Screen

**Priority: Medium** — share PO listing images/text via native share sheet.

**What the reference app shows:**

```
┌────────────────────────────────────┐
│ ← Share Options                    │
│                                    │
│  → Share images/text for           │
│    Purchase Order Listings         │
│                                    │
│  → Share images only               │
│                                    │
│  → Share images with quantity      │
│                                    │
└────────────────────────────────────┘
```

Also appears as a slide-over panel (bottom sheet) from the **Consignment Items** action bar SHARE button, with the same 3 options overlaid on the items list.

**Behaviour per option:**

| Option | What is shared |
|--------|---------------|
| Share images/text for PO Listings | Product images + text listing (PO number, SKU, CCP, CCS, quantities) |
| Share images only | Product images composed into a single share payload |
| Share images with quantity | Product images with quantity overlay text |

All options open the **native OS share sheet** (React Native `Share.share()` or `react-native-share`), which includes WhatsApp, email, etc.

**New file:** `mobile/src/features/outbound/ShareOptionsScreen.tsx`

**New navigation route:** `OutboundShareOptions` with params `{ poId: string, selectedSkuIds: string[], poNumber?: string }`

**Supporting utilities needed:**
- Image download + composition utility (or API endpoint that returns a pre-composed image)
- Text template builder for "Share images/text" mode

---

## 4. Navigation Changes Required

Add these routes to `OutboundStackParamList` in `mobile/src/app/navigation/types.ts`:

```ts
OutboundConsignmentItems: { consignmentId: string; poNumber?: string };
OutboundAddBox: { consignmentId: string; poNumber: string; poId: string; existingBoxCount: number };
OutboundListingDetail: { skuId: string; poNumber?: string; poId?: string };
OutboundPackingSettings: undefined;
OutboundShareOptions: { poId: string; selectedSkuIds: string[]; poNumber?: string };
```

Register them in `RootNavigator.tsx` inside `OutboundStack`:

```tsx
<OutboundStackNav.Screen name="OutboundConsignmentItems" component={ConsignmentItemsScreen} options={{title: 'Consignment Items'}} />
<OutboundStackNav.Screen name="OutboundAddBox" component={AddNewBoxScreen} options={{title: 'Add New Box'}} />
<OutboundStackNav.Screen name="OutboundListingDetail" component={ListingDetailScreen} options={{title: 'Listing Details'}} />
<OutboundStackNav.Screen name="OutboundPackingSettings" component={PackingSettingsScreen} options={{title: 'Default Settings'}} />
<OutboundStackNav.Screen name="OutboundShareOptions" component={ShareOptionsScreen} options={{title: 'Share Options'}} />
```

Also remove the `OutboundBoxes` → `OutboundPlaceholderScreen` mapping and replace with the real `AddNewBoxScreen` (or remove the route if box creation is launched from `ConsignmentItemsScreen` directly).

---

## 5. Component Changes Required (Existing Files)

| File | Change |
|------|--------|
| `SkuItemCard.tsx` | Add `onPress?: () => void` prop; wrap in `Pressable` when provided. Add `selectable?: boolean` + `selected?: boolean` for checkbox rendering in Consignment Items. |
| `PoDetailScreen.tsx` — `ItemsTab` | Pass `onPress` to each `SkuItemCard` → navigate to `OutboundListingDetail`. |
| `OutboundConsignmentDetailScreen.tsx` | Either (a) replace with `ConsignmentItemsScreen` route or (b) add a "View Items" button linking to `ConsignmentItemsScreen`. |
| `outbound.repository.ts` | Add: `fetchConsignmentItemsPage`, `fetchConsignmentLogs`, `fetchBoxSizes`, `createConsignmentBox`. |
| Navigation `types.ts` | Add 5 new routes listed in §4. |
| `RootNavigator.tsx` | Register 5 new screens in `OutboundStack`. |

---

## 6. Summary Table

| Screen | File | Status | Priority |
|--------|------|--------|----------|
| All Companies / All POs / WIP POs | `PoJourneyScreen.tsx` | ✅ Done | — |
| PO Detail (4 tabs) | `PoDetailScreen.tsx` | ✅ Done | — |
| Global Consignments list | `OutboundConsignmentsScreen.tsx` | ✅ Done | — |
| Consignment metadata (key-value) | `OutboundConsignmentDetailScreen.tsx` | ✅ Done (limited) | — |
| **Consignment Items (interactive)** | `ConsignmentItemsScreen.tsx` | ❌ Missing | High |
| **Add New Box / Packing** | `AddNewBoxScreen.tsx` | ❌ Missing (placeholder) | High |
| **Listing Details (SKU in PO)** | `ListingDetailScreen.tsx` | ❌ Missing | Medium |
| **Default / Packing Settings** | `PackingSettingsScreen.tsx` | ❌ Missing | Medium |
| **Share Options** | `ShareOptionsScreen.tsx` | ❌ Missing | Medium |
