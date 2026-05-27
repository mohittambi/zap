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
- **Move to WIP:** POs created in Zap are inserted with **`is_wip = 'YES'`** by default ([`createOutboundPurchaseOrderRow`](../../../src/server/services/outboundPurchaseOrdersService.ts)). If **`is_wip`** reads **NO** on the PO detail card, that usually reflects **synced / channel** state — the PO detail UI may direct teams to resolve WIP in the upstream channel (**eCraft / eAutomate**) before creating consignments.

---

## V. Consignment Creation

- In **WIP** (or when `is_wip` is YES and rules allow mutation), create a **Consignment** from the PO detail flow (**Consignments** affordance — see PO detail client).
- **Assign a Crate / box:** Consignment packing uses box lines via **`POST /api/outbound/consignments/[id]/boxes`** (box name, box number, per-SKU quantities) — see [`boxes/route.ts`](../../../src/app/api/outbound/consignments/[id]/boxes/route.ts). **Manage Boxes:** `/outbound/boxes`.

---

## VI. Packing List Upload (PL Upload)

- Packing list style data (SKU per box, box number, quantities) aligns with **box line capture** APIs above and consignment tooling.
- **Mobile vs web:** Fulfilment steps may split across web consignment/detail and mobile flows — see [Mobile — Outbound screens](../../mobile/outbound-screens.md) for current screen coverage and gaps.

---

## VII. Mark as RTD (Ready to Dispatch)

- Mark the consignment **RTD** and enter dispatch-style fields as supported on **Consignment detail** (`/outbound/consignments/[id]`) — e.g. transporter, vehicle, docket ([`consignment-detail-client.tsx`](../../../src/app/(app)/(logistics)/outbound/consignments/consignment-detail-client.tsx) shows **Marked RTD** metadata and transport fields).

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
| “Add to WIP” | New Zap PO rows default **`is_wip = YES`**; **NO** often means sync/upstream — use WIP hub + PO detail messaging. |
| “Invoice Excel auto-generated” | Outbound invoice artefact here is **file upload/download** + reports/stubs—not the inbound GRN `invoice-export` workbook. |

---

## See also

- [Outbound journey (canonical hub)](../outbound-journey.md)
- [Outbound — business overview](../../business/modules/outbound.md)
- [Pendency PDF — columns and data resolution](pendency-pdf.md)
