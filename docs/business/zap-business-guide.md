---
title: "Zap Platform — Business Guide"
subtitle: "Operations, Logistics & Product Management"
date: "May 2026"
---

# Zap Platform
## Business Guide

**Prepared for:** Leadership, Operations, Sales, Finance, and Warehouse Teams  
**Version:** May 2026

---

\newpage

# Table of Contents

1. [What is Zap?](#what-is-zap)
2. [Who Uses Zap?](#who-uses-zap)
3. [Getting Started](#getting-started)
4. [Roles and Access](#roles-and-access)
5. [Inbound Operations](#inbound-operations)
6. [Outbound Operations](#outbound-operations)
7. [Listings and Inventory](#listings-and-inventory)
8. [Catalogues and Exports](#catalogues-and-exports)
9. [Label Generation](#label-generation)
10. [Vendors](#vendors)
11. [Warehouses and Storage](#warehouses-and-storage)
12. [Forms and Checklists](#forms-and-checklists)
13. [Focus Lists](#focus-lists)
14. [Bulk Operations](#bulk-operations)
15. [End-to-End Workflows](#end-to-end-workflows)

---

\newpage

# What is Zap?

Zap is the company's **central operations platform** — one place where every team can see what's happening with products, stock, purchase orders, vendors, and warehouses, in real time.

Before Zap, teams relied on spreadsheets, manual downloads from the ERP system, and back-and-forth emails to stay in sync. Zap replaces all of that with a single, fast, access-controlled web application — and a companion mobile app (Zap Ops) for warehouse and field teams.

## The problems Zap solves

| Challenge | How Zap addresses it |
|-----------|----------------------|
| Orders from multiple sales channels arriving in different formats | One unified view of all purchase orders, searchable and filterable |
| No team visibility into goods receipt status | GRN status, invoices, and documents visible to all authorised team members |
| Label printing required a separate external tool | Print-ready barcode labels generated instantly inside Zap |
| Product catalogues assembled manually in Excel | Structured catalogue builder with one-click PDF or Excel export |
| New team members overwhelmed by the ERP | Zap shows each role only what they need, in plain language |
| Operations dependent on ERP availability | Critical workflows (labels, acknowledgements, reports) work locally even when ERP is offline |

## How Zap connects to eAutomate

Zap works alongside the company's ERP system (called **eAutomate**). The relationship is straightforward:

```
eAutomate (ERP reference system)
         ↓  sync overnight or on demand
        Zap (operations platform)
         ↓  display + action
 Teams (web browser or mobile app)
```

eAutomate remains the **system of record** for vendor and order data. Zap copies and enriches that data into a fast, team-friendly interface. Local actions in Zap — such as acknowledging an order or generating labels — do not depend on eAutomate being available, reducing operational downtime.

## The mobile app — Zap Ops

Zap has a companion **mobile app** for warehouse and field teams. It connects to the same data and enforces the same access controls as the web app, making it easy to check stock, GRNs, or orders from the warehouse floor.

---

\newpage

# Who Uses Zap?

Zap is designed for multiple teams working together across a single shared data platform.

| Team | What they do in Zap |
|------|----------------------|
| **Operations / Logistics** | Manage inbound goods receipts, track outbound orders, handle consignments and box labels |
| **Merchandising / Category** | Browse the product catalogue, manage SKU details, build and export catalogues |
| **Warehouse team** | View bin placements, check stock levels, use the Zap Ops mobile app |
| **Vendor relations** | Keep the vendor directory up to date, view PO history |
| **Finance / Compliance** | Download invoices, manage debit and credit notes |
| **Sales / Key Accounts** | Monitor order status, build buyer catalogues |
| **Management / Leadership** | View KPIs, download reports, monitor overall order status |

---

\newpage

# Getting Started

## Accessing Zap

| Method | How |
|--------|-----|
| Web application | Open your browser and go to the Zap URL provided by your IT team |
| Mobile app (Zap Ops) | Download from the internal app link or app store |

Log in with your company email address and the password set when your account was created. If you have forgotten your password, use the **Reset Password** link on the login screen.

## Finding your way around

The main navigation is on the left sidebar. Items you see depend on your role — not every team member sees every module.

| Sidebar item | What it is |
|-------------|-----------|
| **Inbound** | Vendor POs, GRNs, delivery notes |
| **Outbound** | Channel POs, consignments, labels, reports |
| **Listings** | Product catalogue, SKU search, inventory |
| **Catalogues** | Catalogue builder and exports |
| **Labels** | Label generation tools |
| **Vendors** | Supplier directory |
| **Warehouses** | Storage locations and bins |
| **Forms** | Operational checklists |
| **Focus Lists** | Your saved product shortlists |
| **Bulk Ops** | Mass import and export |

## Quick-start by role

**Operations / Logistics:** Go to Outbound → Purchase Orders and filter by *Status: Open* to see everything awaiting your attention.

**Merchandising / Category:** Search for a SKU you know well in the Listings module to see how product data is organised.

**Warehouse team:** Download the Zap Ops mobile app — it makes warehouse tasks much faster than a desktop browser.

**Finance:** Go to Inbound → GRNs and filter by *Invoiced but not settled* to see what needs attention first.

**Sales / Key Accounts:** Create a Focus List with the core SKUs for your most important buyer — it saves time every day.

---

\newpage

# Roles and Access

Zap uses a **role-based access system**. Every user is assigned a role, and each role grants access only to the features and data that person's job requires. This protects business data, prevents accidental changes, and ensures accountability — every action in Zap is tied to a specific named user.

Think of it like a key-card system in an office building. A warehouse worker's card opens the warehouse and loading bay, but not the finance department. A finance manager can access accounting records, but not the warehouse management console. An administrator holds a master key.

## Role descriptions

**Administrator** — Full access to all modules, data, and settings. Can create, edit, and deactivate user accounts, assign roles, and trigger data syncs.

**Operations Manager** — Full access to inbound and outbound POs, labels, consignments, reports, and vendor data. Cannot manage user accounts or change financial pricing data.

**Warehouse Staff** — Can raise GRNs, view inbound and outbound POs, look up bin locations, and use the mobile app. Cannot edit product listings, acknowledge orders, or access financial records.

**Finance / Accounts** — Can view GRNs, linked invoices, and debit/credit notes. Can download financial reports. Cannot edit products or perform order actions.

**Merchandising / Category** — Can view and edit product listings, build catalogues, export product data, and use bulk import. Cannot access financial records or order management.

**Sales / Key Accounts** — Can view listings, stock levels, and outbound PO status. Can build catalogues and manage personal focus lists. Cannot edit product data or manage orders directly.

**Read-Only Viewer** — Can view (but not edit) any module they are granted access to. Useful for auditors, senior stakeholders, or temporary access.

## Access at a glance

| Action | Admin | Ops Manager | Warehouse | Finance | Merchandising | Sales |
|--------|:-----:|:-----------:|:---------:|:-------:|:-------------:|:-----:|
| View inbound POs | ✓ | ✓ | ✓ | ✓ | — | — |
| Raise GRN | ✓ | ✓ | ✓ | — | — | — |
| Raise debit / credit note | ✓ | ✓ | — | ✓ | — | — |
| View outbound POs | ✓ | ✓ | ✓ | — | — | ✓ |
| Acknowledge / cancel PO | ✓ | ✓ | — | — | — | — |
| Generate labels | ✓ | ✓ | ✓ | — | — | — |
| Download reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit product listings | ✓ | — | — | — | ✓ | — |
| Build catalogues | ✓ | — | — | — | ✓ | ✓ |
| Manage vendors | ✓ | ✓ | — | ✓ | — | — |
| Bulk import / export | ✓ | ✓ | — | — | ✓ | — |
| Manage users and roles | ✓ | — | — | — | — | — |

## Audit trail

Every action in Zap — raising a GRN, acknowledging an order, editing a product — is logged with the user's name, date, and time. This log is immutable and available to administrators for compliance and audit review.

---

\newpage

# Inbound Operations

## What is "inbound"?

In supply chain terms, **inbound** refers to everything that comes *into* your business from a vendor or supplier — physical goods, invoices, and associated paperwork. Zap's inbound module covers the full journey from the moment a Purchase Order is sent to a vendor, until the goods are received, verified, invoiced, and settled.

## The inbound journey

```
Step 1 ── Purchase Order raised and sent to vendor

Step 2 ── Vendor ships goods

Step 3 ── Goods arrive at warehouse
          Warehouse team creates a GRN in Zap
          Quantities and SKUs are checked and recorded

Step 4 ── Vendor invoice received
          Uploaded and linked to the GRN in Zap

Step 5 ── Finance reviews
          Invoice matched against GRN quantities
          Debit Note raised if goods are short or damaged

Step 6 ── Records closed
          All documents visible to authorised team members
```

## Key terms

| Term | Plain-English meaning |
|------|-----------------------|
| **Purchase Order (PO)** | A formal order your company sends to a supplier |
| **GRN (Goods Receipt Note)** | Confirms what was received, in what quantity, and in what condition |
| **Line item** | A single SKU/product in the PO or GRN |
| **Invoice** | The vendor's bill for the goods supplied |
| **Debit Note** | Raised against a vendor when goods are short, damaged, or returned |
| **Credit Note** | Raised by the vendor in your favour |

## Real example — receiving a vendor shipment

> You ordered 1,000 units from Vendor A across 5 SKUs. The truck arrives on Thursday.

1. The warehouse team opens Zap and finds the inbound PO for Vendor A.
2. They create a GRN, entering actual quantities received for each SKU.
3. While unloading, they notice 50 units are damaged — recorded in the GRN as a short receipt.
4. The vendor's invoice arrives by email and is uploaded into the GRN.
5. Finance reviews, and because of the 50 damaged units, raises a **Debit Note** for their value.
6. The GRN is marked settled. All records are visible and searchable at any time.

## Status flow

| Status | Meaning |
|--------|---------|
| Open | PO sent to vendor; awaiting delivery |
| Partially Received | Some goods arrived; GRN not yet complete |
| Received | All goods received; GRN complete |
| Invoiced | Vendor invoice received and linked |
| Settled | Invoice matched, notes resolved, records closed |
| Cancelled | PO cancelled before delivery |

---

\newpage

# Outbound Operations

## What is "outbound"?

**Outbound** covers everything that goes *out* of your warehouse to a sales channel or buyer — from receiving the channel's purchase order, through packing, labelling, and dispatching the goods.

Your sales channels (e.g. Swiggy Instamart, Blinkit, Zepto) place orders for products they want to stock. Zap helps your operations team receive those orders, plan fulfilment, print all necessary labels and documents, and track what has been sent.

## The outbound journey

```
Step 1 ── Channel places a Purchase Order
          PO syncs into Zap automatically

Step 2 ── Ops team reviews PO in Zap
          Clicks "Acknowledge" — confirms the order is accepted

Step 3 ── Warehouse picks and packs goods
          Team uses PO line items in Zap as a picking guide

Step 4 ── Consignment created
          All boxes going to one destination grouped together

Step 5 ── Box labels generated in Zap
          One barcode label per physical box — downloaded as PDF, printed

Step 6 ── Product labels generated (if required)
          Individual SKU stickers with EAN barcode, MRP, brand details

Step 7 ── Goods dispatched
          Consignment marked as Dispatched in Zap

Step 8 ── Reports downloaded
          SKU Pendency Report saved for records
```

## Key terms

| Term | Meaning |
|------|---------|
| **Outbound PO** | A purchase order received *from* a sales channel; the opposite of an inbound PO you send to a supplier |
| **Acknowledgement** | Confirming to the channel that you have received their PO and will fulfil it |
| **Consignment** | A group of boxes all going to the same destination in one shipment |
| **Box label (Phase 1)** | Barcode label on each shipping carton identifying the consignment, box number, and destination |
| **Product label** | Sticker placed on individual units showing MRP, barcode, brand, manufacturer, and country of origin |
| **SKU pendency** | Items in a PO that have not yet been dispatched |

## Real example — fulfilling a Blinkit order

> Blinkit places PO #MBEPO16587 for 2,400 units across 36 SKUs, to be delivered to their Gurgaon warehouse.

**Day 1 — Order received**
The PO syncs into Zap overnight. The ops manager finds it, clicks **Acknowledge**, and the status changes to In Progress.

**Day 2–3 — Warehouse packs**
The warehouse team uses the PO detail page to pick 36 SKUs. Goods are packed into 45 boxes. The ops manager enters box range 1–45 in the **Phase 1 Box Labels** tool, selects label size, and downloads a 45-page PDF. One page per box — printed and attached.

**Day 4 — Product labelling**
For 8 SKUs requiring unit stickers, the ops manager opens **Generate Product Labels**, selects those SKUs, enters quantities, and downloads the label PDF. Labels are printed and affixed in the warehouse.

**Day 4 — Dispatch**
The truck arrives, boxes are handed over, and the consignment is marked Dispatched. A **SKU Pendency Report** is downloaded for the records.

## PO status flow

| Status | Meaning |
|--------|---------|
| Open | PO received; awaiting acknowledgement |
| Acknowledged | Ops team confirmed the order is accepted |
| In Progress | Warehouse is picking and packing |
| Ready to Dispatch | All boxes packed and labelled |
| Dispatched | Goods handed to courier or transport |
| Cancelled | PO cancelled before dispatch |

---

\newpage

# Listings and Inventory

## What is "listings and inventory"?

A **listing** is Zap's record for a single product variant — everything the business needs to know about that product in one place: name, barcode, dimensions, pricing, images, warehouse location, and current stock level.

**Inventory** refers to the physical stock count — how many units of each product are held in which warehouse or bin.

Together, they give every team a single, reliable answer to: *"What do we have, where is it, and what does it look like?"*

## What is stored on each product listing?

| Field | What it contains |
|-------|-----------------|
| SKU / Article code | Unique identifier for this product variant |
| Product name | Full name including variant (e.g. "Blue, 3-piece set") |
| Brand | The selling brand |
| Category | Where the product fits in the product hierarchy |
| EAN / Barcode | 13-digit global barcode for scanning and labelling |
| MRP | Maximum Retail Price, used on product labels |
| Dimensions and weight | Used for logistics costing and box planning |
| Images | Product photography linked to the listing |
| Country of origin | Required for legal labelling |
| Manufacturer details | Name and address for the product label |
| Bin location | Which aisle/shelf/bin in the warehouse holds this SKU |
| Stock level | Quantity on hand, by warehouse |

## Understanding stock levels

Zap tracks inventory across multiple warehouses. For each SKU you can see:

- **Quantity on hand** — units physically present
- **Inbound pending** — units ordered from vendors, not yet received
- **Outbound pending** — units committed to channel orders, not yet dispatched
- **Net available** — on hand minus outbound pending

> **Example:** SKU A has 500 units on hand, 200 committed to a Blinkit PO, and 100 more arriving from a vendor. Net available = 300 units.

## Real example — looking up a product

> A Key Account Manager is on a call with a buyer who asks about the dimensions and current stock of a kitchen storage set (SKU: KSS-001).

Without Zap, the KAM would need to email the warehouse and wait for a reply.

With Zap, the KAM searches "KSS-001" in the Listings module. Within seconds, the listing shows product name, images, dimensions, weight, MRP, HSN code, and current stock per warehouse. The KAM shares the details with the buyer in under 60 seconds.

## How listings connect to everything else

```
Product Listing (SKU master)
     ↕
Inbound PO → GRN → Stock increases
     ↕
Outbound PO → Dispatch → Stock decreases
     ↕
Labels module → Product stickers generated from listing data
     ↕
Catalogue builder → Marketing catalogue uses listing images and fields
```

Listings are the foundation that every other module depends on. Keeping listings accurate ensures that reports, labels, and catalogues all have correct, up-to-date information.

---

\newpage

# Catalogues and Exports

## What is the Catalogue module?

The **Catalogue module** allows the team to build and manage structured product catalogues — collections of products organised for a specific purpose, such as a buyer presentation, a seasonal range, or a channel assortment.

Think of a catalogue as a branded, formatted product booklet that can be exported as a PDF or Excel file and shared with buyers, account managers, or internal teams.

## How catalogue creation works

```
Step 1 ── Create a new catalogue
          Name it; choose a layout template

Step 2 ── Add products
          Search listings and select SKUs
          Images and pricing auto-filled from product records

Step 3 ── Review and arrange
          Reorder items; check images and pricing

Step 4 ── Export
          Download as PDF or Excel

Step 5 ── Share
          Email, present in meeting, or share digitally
```

## Real example — preparing a buyer catalogue

> The sales team has a pitch meeting with a large retail chain. They want to present 80 home décor products with images, descriptions, and pricing.

1. A merchandiser opens the Catalogue module and creates "Home Décor — Summer 2026."
2. They add 80 SKUs — images and prices are pulled automatically from the listings.
3. They click **Export to PDF** — a formatted, brand-ready document is downloaded in seconds.
4. The sales team takes it to the meeting.

Without Zap, this would have taken hours of manual work in a design tool or Excel.

---

\newpage

# Label Generation

## Product Labels

**Product labels** are the stickers affixed to each individual unit of a product before dispatch. They carry legally required information and a scannable barcode used by channels for their inventory systems.

Zap generates print-ready label PDFs directly from the product's listing data — no separate design software is needed.

### What appears on a product label?

| Field | Where it comes from |
|-------|---------------------|
| Product name | Listing |
| Brand | Listing |
| MRP | Listing |
| EAN-13 barcode | Listing (auto-rendered as scannable barcode) |
| Manufacturer name and address | Fixed settings / listing |
| Country of origin | Listing |
| Net weight / quantity | Listing |

### How to generate product labels — the 4-step wizard

**Step 1 — SKU list:** Zap auto-fetches all SKUs for the selected PO.

**Step 2 — Fixed settings:** Confirm or edit the manufacturer name and address — fields that are the same across all SKUs.

**Step 3 — Quantities:** For each SKU, enter the number of labels needed.

**Step 4 — Label size:** Choose 70×40mm or 75×38mm based on available printing stock.

Click **Generate** — a multi-page PDF is downloaded, one label per page, ready to send to the printer.

---

## Box Labels (Phase 1)

**Box labels** are applied to the outside of each shipping carton. They identify:

- The consignment / PO number
- Destination company and city
- Box number (e.g. "Box 15 of 60")
- A Code-128 barcode for scanning at the destination warehouse
- Date of packing

### How to generate box labels

1. Open the outbound PO in Zap.
2. Click **Generate Phase 1 Box Labels**.
3. Enter the box range (e.g. 1 to 60).
4. Select the label size.
5. Click **Generate** — a PDF downloads with one label per page.
6. Print and attach one label to each box before dispatch.

---

## Label size options

| Size | Typical use |
|------|-------------|
| 70 × 40 mm | Standard product and box labels |
| 75 × 38 mm | Slightly wider labels for certain product categories |

---

\newpage

# Vendors

## What is the Vendor module?

The **Vendor module** is Zap's directory of all suppliers, manufacturers, and trade partners. Every company that sells goods to your business has a record here — a live profile connecting contact details, purchase history, linked SKUs, and financial notes in one place.

## What is stored per vendor?

| Field | Contents |
|-------|---------|
| Company name | Vendor's trading name |
| Contact person | Primary point of contact |
| Phone and email | Communication details |
| Address | Billing and shipping address |
| GST / Tax ID | For invoicing and compliance |
| Linked SKUs | Products this vendor supplies |
| PO history | All inbound POs placed with this vendor |
| Payment terms | Net-30, Net-60, etc. |

## Real example — finding a vendor's details

> Finance needs the GST number and address of Vendor X to raise a debit note for short-delivered goods.

1. Open the Vendors module, search for the vendor by name.
2. The record appears — GST number, full address, and contact details visible instantly.
3. Finance copies the details into the debit note.

No chasing emails. No outdated spreadsheets.

---

\newpage

# Warehouses and Storage

## What is the Warehouse module?

The **Warehouse module** provides a structured map of all physical storage locations used by the business — down to the individual **bin** level. A bin is the smallest identifiable storage unit inside a warehouse (e.g. "Aisle B, Shelf 3, Right = B-03-R").

## Why structured warehouse management matters

| Without structured locations | With Zap warehouse bins |
|-----------------------------|------------------------|
| "It's somewhere in the back" | "SKU XYZ is in Bin B-03-R, Warehouse Pune" |
| New staff take weeks to learn the layout | Search by SKU → bin location shown instantly |
| Stock counts require walking the entire floor | Count a specific bin for a specific SKU |
| Mis-picks and wrong-item shipments | Confirm bin before picking |

## Real example — finding a product's location

> A warehouse worker needs to pick 50 units of a cleaning product for an urgent outbound order.

1. The supervisor searches for the SKU in Zap.
2. The product page shows: "Bin C-07-L, Warehouse Mumbai — 280 units available."
3. The worker walks directly to Bin C-07-L. No searching. No delay.

---

\newpage

# Forms and Checklists

## What are Forms?

**Forms** in Zap are digital checklists that teams fill in as part of regular operational tasks. They replace paper-based or spreadsheet checklists with tracked, searchable digital records.

Examples:
- Daily warehouse opening checklist
- Pre-dispatch quality check
- Incoming goods inspection report

## Real example — pre-dispatch quality check

> Before a consignment of 60 boxes leaves the warehouse, a supervisor runs a quality check on a sample.

1. The supervisor opens the "Pre-Dispatch QC" form in Zap.
2. The form lists all checkpoints: box sealing, label presence, temperature (if cold chain), etc.
3. Each checkpoint is ticked — or flagged if there is an issue.
4. On submission, the form is saved against the consignment with the supervisor's name and timestamp.
5. If an issue was flagged, the dispatch is held pending resolution.

---

\newpage

# Focus Lists

## What is a Focus List?

A **Focus List** is a personally curated shortlist of products that a team member wants to track closely — similar to a watchlist. You add the SKUs you care about most, and they are always one click away.

Useful for:
- Category managers tracking a specific product range
- Sales reps managing a particular buyer's assortment
- Operations tracking SKUs with recurring stock issues

## Real example — a buyer's product shortlist

> An account manager is responsible for the Zepto account. Zepto stocks 120 of your SKUs, but 15 are high-velocity and need close attention.

1. The account manager creates a Focus List: "Zepto — Core 15."
2. They add the 15 SKUs.
3. Each morning, they open this list instead of searching the full catalogue — and see stock levels, pending inbound, and any flags for those 15 products at a glance.

---

\newpage

# Bulk Operations

## What are Bulk Operations?

**Bulk Operations** allow team members to create, update, or export many records at once — rather than editing them one by one.

## Common uses

| Task | How Bulk Ops helps |
|------|--------------------|
| Onboarding new products | Upload hundreds of new SKUs via spreadsheet |
| Price updates | Update MRP or cost price for many SKUs together |
| Bin location changes | Reassign multiple SKUs after a warehouse reorganisation |
| Export for reporting | Download a full filtered set of listings for analysis |
| Stock count upload | Upload physical count results to reconcile stock levels |

## How bulk import works

```
Step 1 ── Download the official Zap template
          Ensures your spreadsheet has the right columns

Step 2 ── Fill in the template
          One row per SKU or record

Step 3 ── Upload the file
          Zap validates each row

Step 4 ── Review errors
          Fix any flagged rows before confirming

Step 5 ── Confirm import
          All valid rows are processed

Step 6 ── Download summary
          Shows how many rows succeeded, failed, or were skipped
```

## Important notes

- Always use the **official Zap template** — custom column names will cause errors.
- Zap validates every row before saving — no partial imports that corrupt existing data.
- A full audit trail is kept: who imported what, and when.
- If an import fails, the existing data is untouched.

---

\newpage

# End-to-End Workflows

This section describes the five most important processes that Zap supports from start to finish.

---

## Workflow 1 — Vendor Order to Stock Receipt

*When your company orders products from a supplier and receives them.*

**Who is involved:** Procurement → Vendor → Warehouse → Finance

```
1. Procurement raises a Purchase Order
   Sent to vendor; PO record synced in Zap

2. Vendor ships goods

3. Goods arrive at warehouse
   Warehouse team raises a GRN in Zap
   Quantities entered per SKU; short or damaged items flagged

4. Invoice received from vendor
   Uploaded to the GRN; linked to the PO record

5. Finance reviews
   Checks GRN quantities against invoice
   Debit Note raised if goods are short or damaged

6. Stock levels updated in Zap
   Bin location recorded for each received SKU

7. PO marked settled
   All records closed and searchable for audit
```

---

## Workflow 2 — Channel Order Fulfilment

*When a sales channel (e.g. Blinkit) places an order and you fulfil it.*

**Who is involved:** Channel → Ops team → Warehouse → Dispatch

```
1. Channel places Purchase Order
   PO syncs into Zap; visible in Outbound POs list

2. Ops team acknowledges the order
   Status changes to In Progress

3. Warehouse picks and packs
   Team refers to PO line items in Zap
   Goods packed into numbered boxes

4. Box labels generated from Zap
   Enter box range → download PDF → print and attach one label per box

5. Product labels generated if required
   Select SKUs → enter quantities → choose size → download PDF → print and affix

6. Goods dispatched
   Transport arrives; boxes handed over
   Ops team marks consignment as Dispatched

7. Reports downloaded
   SKU Pendency Report filed
   Any shortfall noted for follow-up
```

---

## Workflow 3 — Catalogue Creation and Sharing

*When the sales team needs a formatted product catalogue for a buyer.*

**Who is involved:** Merchandising / Sales → Catalogue module → Buyer

```
1. Merchandiser opens Catalogue module

2. Creates a new catalogue
   Names it; selects a layout template

3. Adds products
   Searches listings; selects SKUs
   Images and pricing auto-filled

4. Reviews and arranges
   Checks all content; makes edits

5. Exports as PDF or Excel
   File downloads immediately

6. Shares with buyer
   Email, printed copy, or digital share
```

---

## Workflow 4 — New Vendor Onboarding

*When the company starts working with a new supplier.*

**Who is involved:** Procurement → Vendors module → Merchandising

```
1. Procurement agrees terms with new vendor

2. Vendor record created in Zap
   Name, address, GST number, contact details, payment terms

3. New SKUs linked to the vendor
   Listings created with manufacturer and origin details

4. First Purchase Order raised
   PO created against the new vendor
   GRN will be raised on delivery

5. Labels and catalogue pages ready
   Because the listing is complete, labels and catalogues
   can be generated immediately
```

---

## Workflow 5 — Stock Reconciliation

*When the team needs to verify that physical stock matches system records.*

**Who is involved:** Warehouse → Operations → Finance

```
1. Warehouse team conducts physical count
   Counts units in each bin, SKU by SKU

2. Count results entered into spreadsheet
   Using the official Zap bulk import template

3. Uploaded via Bulk Operations
   Zap compares physical count vs system quantity
   Discrepancies flagged automatically

4. Discrepancies reviewed
   Each flagged SKU investigated
   Cause identified (unlisted dispatch, damage, counting error, etc.)

5. Adjustments made in Zap
   Corrections entered; each adjustment logged with reason and user

6. Reconciliation report downloaded
   Summarises count, discrepancies found, and adjustments made
   Filed for audit
```

---

\newpage

# Contact and Support

| Need | Who to contact |
|------|---------------|
| Account or login issue | IT / System administrator |
| Training on a specific module | Operations manager or team lead |
| Reporting a system error | IT helpdesk or the Zap support channel |
| Requesting a new feature | Product owner or operations manager |
| API access or integrations | IT / System administrator |

---

*Zap Platform — Business Guide — May 2026*
