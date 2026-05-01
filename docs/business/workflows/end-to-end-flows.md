# End-to-End Operational Workflows

**Audience:** All operations and logistics teams  
**Plain-language guide to:** Key business processes from start to finish

---

## Overview

This document describes the five most important end-to-end workflows that Zap supports. Each workflow is shown as a sequential flow with plain-language descriptions at every step.

---

## Workflow 1 — Vendor Order to Stock Receipt (Inbound)

*When your company orders products from a supplier and receives them.*

```
1. Procurement raises a Purchase Order (PO)
   → Sent to vendor (by email or ERP)
   → PO record created / synced in Zap

2. Vendor confirms and ships
   → Goods leave vendor's facility

3. Goods arrive at your warehouse
   → Warehouse team opens Zap
   → Finds the inbound PO
   → Creates a Goods Receipt Note (GRN)
   → Enters quantities received per SKU
   → Flags any damaged or missing items

4. Invoice received from vendor
   → Uploaded to the GRN in Zap
   → Linked to the correct PO record

5. Finance reviews
   → Checks GRN quantities against invoice
   → Raises Debit Note if goods are short or damaged
   → Or approves invoice for payment

6. Stock levels updated
   → Zap reflects new stock on hand
   → Bin location recorded for each received SKU

7. PO marked settled
   → All records closed and searchable for audit
```

**Who is involved:** Procurement → Vendor → Warehouse → Finance

---

## Workflow 2 — Channel Order Fulfilment (Outbound)

*When a sales channel (e.g. Blinkit) places an order and you fulfil it.*

```
1. Channel places Purchase Order
   → PO synced into Zap from eAutomate
   → Ops team sees it in the Outbound POs list

2. Acknowledgement
   → Ops team clicks "Acknowledge" in Zap
   → Status changes to In Progress
   → Channel is notified (via eAutomate)

3. Warehouse picks and packs
   → Warehouse team refers to PO line items in Zap
   → Products picked from bin locations
   → Packed into numbered boxes

4. Box labels generated
   → Ops team enters box range in Zap (e.g. 1–45)
   → Downloads Phase 1 Box Label PDF
   → Labels printed and attached to each box

5. Product labels generated (if required)
   → Ops team uses Generate Product Labels wizard
   → Selects SKUs, enters quantities
   → Downloads label PDF
   → Labels printed and affixed to units

6. Goods dispatched
   → Transport arrives; boxes handed over
   → Ops team marks consignment Dispatched in Zap

7. Reports generated
   → SKU Pendency Report downloaded
   → Records filed; any shortfall noted for follow-up
```

**Who is involved:** Channel → Ops team → Warehouse → Logistics/Dispatch

---

## Workflow 3 — Catalogue Creation and Sharing

*When the sales team needs a formatted product catalogue for a buyer meeting.*

```
1. Merchandiser opens Catalogue module in Zap

2. Creates a new catalogue
   → Names it (e.g. "Blinkit Q3 — Kitchenware")
   → Selects a layout template

3. Adds products
   → Searches the product listings
   → Selects required SKUs (images and details auto-filled from listings)
   → Arranges the order

4. Reviews the catalogue
   → Checks all prices, images, and descriptions
   → Makes any last-minute edits

5. Exports
   → Clicks "Export to PDF" (or Excel)
   → File downloads immediately

6. Shares with buyer
   → Sent by email or presented in meeting
```

**Who is involved:** Sales / Merchandising → Catalogue tool → Buyer

---

## Workflow 4 — New Vendor Onboarding

*When the company starts working with a new supplier.*

```
1. Procurement agrees terms with new vendor

2. Vendor record created in Zap
   → Name, address, GST number, contact details entered
   → Payment terms noted

3. New SKUs linked
   → Products supplied by this vendor are linked to the vendor record
   → Listing fields (manufacturer, country of origin) filled in

4. First PO raised
   → Purchase Order created against the new vendor
   → PO record in Zap; GRN will be raised on delivery

5. Label and catalogue data ready
   → Because the listing is complete, labels and catalogue pages can be generated immediately
```

**Who is involved:** Procurement → Vendors module → Merchandising

---

## Workflow 5 — Stock Reconciliation

*When the team needs to verify that physical stock matches system stock.*

```
1. Warehouse team conducts a physical count
   → Counts units in each bin, SKU by SKU

2. Count results entered into spreadsheet
   → Using Zap's bulk import template

3. Uploaded via Bulk Operations
   → Zap compares physical count vs system quantity
   → Discrepancies flagged automatically

4. Discrepancies reviewed
   → Each flagged SKU is investigated
   → Cause identified (e.g. unlisted dispatch, damaged goods, counting error)

5. Adjustments made
   → Corrections entered in Zap
   → Each adjustment logged with reason and user

6. Reconciliation report downloaded
   → Summarises the count, discrepancies found, and adjustments made
   → Filed for audit purposes
```

**Who is involved:** Warehouse team → Operations → Finance (for audit)

---

## Cross-module summary

The diagram below shows how each module in Zap feeds into the others:

```
Vendor records ──────→ Inbound POs ──────→ GRN (goods received)
                                                ↓
Product Listings ←────── Stock levels updated
      ↓
Catalogue builder → Buyer catalogue exports
      ↓
Outbound POs ──────→ Label generation → Dispatch
      ↓
Bulk Operations → Mass updates, stock reconciliation
```

No module is an island — they all share the same underlying product and stock data, ensuring consistency across every team.

---

*Back to:* [Business Documentation Index](../index.md)  
*See also:* [Inbound Module](../modules/inbound.md) | [Outbound Module](../modules/outbound.md)
