# Outbound Tab – Process Notes (ZAP Website)

**System of record:** Zap (this application’s database, APIs, and UI) is the place operators run outbound POs, consignments, labels, and invoice file handoff. Where data is **synced** from another system, the UI still reads whatever has landed in Zap.

**Navigation (web):** Outbound → **Purchase Orders** | **SKU / EAN Mappings** | Consignments | Pending Invoices | Manage Boxes ([`outbound-sub-nav.tsx`](../../../src/components/layout/outbound-sub-nav.tsx)). Under **Purchase orders** (color-coded sub-menu): All Purchase Orders (`/outbound`), WIP Purchase Orders (`/outbound/wip`), Partially Created Purchase Orders (`/outbound/partial`), Add New Purchase Order (`/outbound/new`) — [`outbound-po-sub-nav.tsx`](../../../src/components/layout/outbound-po-sub-nav.tsx). **SKU / EAN Mappings** (`/outbound/ean-mappings`) — wide matrix table via [`DataTable`](../../../src/components/data-table/) and `GET /api/ean-mappings/matrix`.

**Technical / storytelling context:** [Business — Outbound module](../../business/modules/outbound.md) · [Outbound consignments data sync plan](../../outbound-consignments-data-sync-plan.md) · [Mobile outbound screens](../../mobile/outbound-screens.md)

---

## I. PO Creation (Add New Purchase Order)

- Go to the **Outbound** tab and select **Add New Purchase Order** (`/outbound/new`).
- Fill in the required details on the form:
  - **Sold Via**
  - **Company Name**
  - **PO Number** (see **Zap note** below)
  - **Location** (delivery city / reference location)
  - **Billing Address** (as per PO)
  - **Shipping Address**
  - **Buyer GSTIN** (optional; validated when present)
  - **PO Release Date**

**Zap note — PO number:** Zap issues a system **`po_number`** such as `ZAP-PO-{timestamp}-…` when the PO row is created ([`createOutboundPurchaseOrderRow`](../../../src/server/services/outboundPurchaseOrdersService.ts)). There is no separate free-text “channel PO number” field on the create form; reference the buyer’s PO number in uploaded documents or internal process.

---

## II. PO Details Completion

The **same** create screen ([`outbound/new/page.tsx`](../../../src/app/(app)/(logistics)/outbound/new/page.tsx)) also collects:

- **PO Expiry Date**
- **PO Type** — must be one of [`OUTBOUND_PO_TYPES`](../../../src/lib/outbound-po-types.ts) (e.g. Regular/BAU, Diwali, Rakhi, Holi, Valentine’s Day, Makar Sankranti, Dussehra, Ganesh Chaturthi, Ugadi, and the rest of the configured list).
- **Upload PO documents** at submit time:
  - **Original Excel/CSV** (spreadsheet)
  - **PDF** file

#### Zap-required order (files at create)

[`POST /api/outbound/purchase-orders`](../../../src/app/api/outbound/purchase-orders/route.ts) requires **exactly two** files in one submission: **one PDF** and **one** spreadsheet/CSV (`.xlsx`, `.xls`, or `.csv`), **2MB each**. You cannot submit the header form without both.

If your training narrative describes “submit first, then download a template, then upload line items only later,” treat the **create-time pair** as the channel PO package (PDF + spreadsheet). **Line-level SKU grid** population is reinforced from the **PO detail** attachment uploader (next section).

---

## III. Item Details Upload

- Use the **sample line-items format** linked from the PO detail page: [`/samples/outbound/sample_po_line_items_spreadsheet.csv`](../../../public/samples/outbound/sample_po_line_items_spreadsheet.csv) (vendor headers: Item Code, HSN Code, IGST %, Quantity, MRP, Landing Rate, Margin %, Total Amount—or the channel’s own spreadsheet that matches the parser).
- Fill with item details, item codes, HSN, GST/IGST rate, quantities, and commercial columns per sample.
- On **create** (`/outbound/new`), **Original PO files** (PDF + spreadsheet) are stored as Zap attachments and listed on detail under **Original PO documents** (source **Zap**).
- On **PO detail** (`/outbound/po/[id]`), use **Add PO document** in the same section for more uploads; **`POST /api/outbound/purchase-orders/[id]/attachments`** parses spreadsheets through [`parseOutboundPoLineItemsSpreadsheet`](../../../src/server/utils/outboundPoListingSpreadsheetParse.ts) and can refresh **`listingsUpdated`** on success toast.
- After **`npm run sync:outbound-po-detail`**, eAutomate originals appear in **Original PO documents** (source **eAutomate**); SKU lines and summary can come from eAutomate listings sync.

After line data is reflected, the PO appears in **All Purchase Orders** (`/outbound`).

#### Zap-required order (line items)

Initial create already stores PDF + spreadsheet. **SKU line grid** updates when a **spreadsheet** is processed on the attachments route—not every PDF attachment updates lines.

---

## IV. Move PO to WIP (Work in Progress)

- The Operations team selects the PO from **All Purchase Orders** or **WIP Purchase Orders** (`/outbound/wip`).
- **Move to WIP:** POs created in Zap default to **`is_wip = 'Y'`** ([`createOutboundPurchaseOrderRow`](../../../src/server/services/outboundPurchaseOrdersService.ts)). On PO detail (**Details** tab), use **WIP status → Y** to mark WIP in Zap (`save_field` on `is_wip` — local DB only). Legacy synced rows may still show **YES**; both **Y** and **YES** count as WIP.

---

## V. Consignment Creation

- When the PO is **WIP** (`Y` or `YES`) and **acknowledged** (`po_acknowledgement_status` = YES), create a **Consignment** from the PO detail **PO Consignments** tab (**Create New Consignment**). A confirm dialog creates an **empty** consignment in Zap via **`POST /api/outbound/purchase-orders/[id]/consignments`** (no packing at create time). The UI navigates to **Consignment detail** to enter lines.

---

## VI. Consignment line items (packing)

- On **Consignment detail** (`/outbound/consignments/[id]`), **Current Consignment Summary** shows **Boxes**, **SKUs**, and **Total Qty** (zeros until lines are saved).
- Consignment detail includes a **PO line items** table (same columns as the PO detail page) loaded from the linked PO `listings_snapshot` via `GET /api/outbound/consignments/[id]/po-listings`.
- Operators pack **per PO SKU** via **Enter packing** (modal) or the **Bulk form** (grid + optional TSV paste): each SKU can span **multiple box lines** (box name, quantity). Apply updates the summary table; **Save lines** persists. The editor shows **PO Secondary SKU** (`po_secondary_sku`, e.g. `10149918`) and **Company Code Primary** (`company_code_primary`, e.g. `AAC500`) — same columns as the PO line-items grid. TSV upload/download uses the same 9 columns with **multiple rows per SKU** allowed: `po_secondary_sku`, `company_code_primary`, then demand, dispatch, reserved, pending, box number, box quantity, and box name.
- Draft SKUs prefill from the PO `listings_snapshot`; demand/dispatch/pending are read-only. **Sum of box quantities per SKU must not exceed pending** (blocked server-side and in the modal).
- **`GET /api/outbound/consignments/[id]/line-items/drafts`** — `{ skus, source, poNumber }`; **`POST …/line-items/save`** — body `{ skus: [...] }`, validate and replace all lines, refresh consignment aggregates.
- Legacy bin CSV upload remains available via **`POST /api/outbound/consignments/[id]/packing-upload/*`** and **`POST …/boxes`** if needed.

---

## VII. Mark as RTD (Ready to Dispatch)

- After lines are saved (`boxes_count > 0`), use **Mark for dispatch** on **Consignment detail** to set status **`MARKED_RTD`**.
- Dialog collects **transporter** (`GET /api/outbound/transporters`), **shipment type** (Surface / Air / Express, stored in `raw.shipment_type`), and **docket number**.
- **`POST /api/outbound/consignments/[id]/mark-rtd`** — Zap-only; sets `marked_rtd_at`, `marked_rtd_by`, transporter, docket, and transport card on detail.

### Post-RTD line item tab views

When **`marked_rtd_at`** is set or status is **`MARKED_RTD`**, the packing editor is replaced by read-only **tab views** on saved `outbound_consignment_items` rows:

| Tab | Purpose |
|-----|---------|
| **Default View** | One row per box line (Sr. No, SKUs, box, qty, name, submitted from, created by, timestamps) |
| **Box Wise View** | Aggregated per box number |
| **SKU Wise View** | Aggregated per PO secondary SKU |
| **PO Wise View** | SKU-level commercial columns (MRP, demand, dispatch, consignment qty, fill rate %, box list) |

- Data: **`GET /api/outbound/consignments/[id]/line-items/rows`** — flat rows ordered by box.
- **Download Current View** exports the active tab as CSV.
- **`POST …/line-items/save`** is rejected (409) once marked RTD.
- Plan: [consignment-line-items-views-plan.md](consignment-line-items-views-plan.md).

---

## VIII. Invoice Processing (Accounts Team)

- After RTD, consignments that still need invoice capture appear under **Pending Invoices** (`/outbound/pending-invoices`) — same row filter as the mobile pending-invoices list.
- **Accounts** assigns or confirms **Invoice Number** / status as represented on the consignment row (`invoice_number`, `invoice_number_status`) — often **populated through sync** into Zap for this module; confirm your tenant’s source of truth for assigning numbers.

**Invoice file / download (not “Excel push”):** There is **no** inbound-style `buildInvoiceExcel` for outbound in this repo. Operators **download** the **uploaded** invoice file (when present) via **`GET /api/outbound/consignments/[id]/invoice`** (signed URL).

**PO reports (Zap-generated):** From PO detail, [`eautomate-actions`](../../../src/app/api/outbound/purchase-orders/[id]/eautomate-actions/route.ts) can return:

- **`download_sku_report`** — CSV (Master SKU, GST %, commercial columns).
- **`download_pendency_pdf`** — PDF with **PO SKU** (channel code), **Company Code Primary** (`master_sku` such as `AAC500`, not a duplicate of PO SKU), **Warehouse Inventory** (Zap bins), **M.R.P**, **Pending**. Full column rules: [pendency-pdf.md](pendency-pdf.md).

---

## IX. Box Label & Invoice Upload

- **Operations:** Generate **Phase 1 box labels** (PDF) from PO detail actions where enabled ([`outbound-po-detail-client.tsx`](../../../src/app/(app)/(logistics)/outbound/outbound-po-detail-client.tsx) — `generate_phase1_box_labels`).
- **Accounts:** Create the invoice offline as required, then **upload** the invoice copy: **`POST /api/outbound/consignments/[id]/invoice-upload`** (see consignment detail **Upload invoice**).
- Once uploaded and statuses update, rows typically leave the **pending invoice** filter and remain visible under **Consignments** (`/outbound/consignments`).

---

## Summary Flow

PO Creation → Details Fill (+ **two files at submit**) → Line spreadsheet refinement on PO detail (**Attachments**) → **All PO** → **WIP** (filter / synced flag) → **Consignment** create → **Packing / boxes** (**boxes** API) → **RTD** → **Accounts** (invoice number + **Pending Invoices**) → **Label download** → **Invoice upload** → **Consignments**

### Zap reminders

| Narrative shorthand | Zap behaviour |
|--------------------|----------------|
| “Template downloaded after PO submit” | Create requires **PDF + spreadsheet** immediately; PO detail links **sample CSV** for column shape; optional **attachments** uploads refresh lines when parsed. |
| “Add to WIP” | New Zap PO rows default **`is_wip = Y`**; toggle **Y/N** on PO detail; **Y** and **YES** both count as WIP for consignment create. |
| “Invoice Excel auto-generated” | Outbound invoice artefact here is **file upload/download** + reports/stubs—not the inbound GRN `invoice-export` workbook. |

---

## See also

- [Outbound journey (canonical hub)](../outbound-journey.md)
- [Outbound — business overview](../../business/modules/outbound.md)
- [Pendency PDF — columns and data resolution](pendency-pdf.md)
