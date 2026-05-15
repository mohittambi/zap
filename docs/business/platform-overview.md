# Zap Platform — Business Overview

**Document type:** Executive summary  
**Audience:** Leadership, Product Owners, Operations Managers

---

## What is Zap?

Zap is an **internal operations management platform** built for the day-to-day running of an e-commerce and retail supply chain business. Think of it as the company's **command centre** — one place where every team can see what's happening with products, stock, orders, vendors, and warehouses.

Before Zap, teams relied on spreadsheets, manual downloads from the ERP system, and back-and-forth emails to coordinate. Zap brings all of that into one fast, access-controlled web application — and a companion mobile app (Zap Ops) for teams on the warehouse floor or on the move.

---

## What problems does Zap solve?

| Problem (Before Zap) | How Zap solves it |
|----------------------|-------------------|
| Orders from multiple sales channels arriving in different formats | One unified view of all outbound purchase orders, searchable and filterable |
| Goods receipt notes (GRNs) managed in eAutomate with no team visibility | GRN status, invoices, and documents visible inside Zap for every team member with access |
| Label generation required a separate design tool or external system | Print-ready barcode labels generated instantly inside Zap, in the right size and format |
| Product catalogues assembled manually in Excel | Structured catalogue builder with one-click PDF or Excel export |
| New team members overwhelmed by the ERP | Zap presents only what each role needs to see, in plain language |

---

## Who uses Zap?

Zap is designed for multiple teams working together:

| Team / Role | What they do in Zap |
|-------------|----------------------|
| **Operations / Logistics** | Manage inbound goods receipts, track outbound orders, handle consignments and box labels |
| **Merchandising / Category** | Browse the product catalogue, manage SKU details, build and export catalogues |
| **Warehouse team** | View bin placements, check stock levels, use the Zap Ops mobile app |
| **Vendor relations** | Keep the vendor directory up to date, view PO history |
| **Finance / Compliance** | Download invoices, manage debit/credit notes, audit logs |
| **Management / Leadership** | View KPIs, download reports, monitor order status |

---

## What can Zap do? — Module summary

Zap is organised into **functional modules**. Each module is described in its own document, but here is the top-level summary:

### 1. Inbound Operations
Track every purchase order sent to a vendor, from creation to goods receipt and invoice collection. Zap gives visibility into what has arrived, what is pending, and what has been rejected or disputed.

**Example:** A warehouse team receives 500 units from a vendor. The GRN (Goods Receipt Note) is raised, quantities are entered, and the invoice is uploaded — all in Zap. Finance can see the note immediately without chasing anyone for a spreadsheet.

### 2. Outbound Operations
Manage every purchase order received from sales channels (e.g. Swiggy, Blinkit). Track their status from acknowledgement through dispatch, with automatic consignment generation, PDF pendency reports, and label printing.

**Example:** Blinkit places an order for 3,000 units across 40 SKUs. Zap shows the PO details, lets the ops team mark it as Work in Progress, generate box labels for each packed consignment, and track what has been dispatched vs what is still pending.

### 3. Product Listings and Inventory
The full product catalogue lives in Zap — every SKU with its images, dimensions, pricing, bin location, and incoming/outgoing history. Teams can search, filter, and drill into any SKU in seconds.

**Example:** A buyer asks "how many units of SKU X are in Warehouse B?" — the ops team opens Zap, searches the SKU, and sees the exact bin placement and quantity without opening the ERP.

### 4. Catalogues and Exports
Build structured product catalogues and export them to PDF or Excel in branded formats. Standard catalogues can be maintained on an ongoing basis; custom ones can be built for specific buyers or occasions.

**Example:** A sales executive needs a catalogue of 150 home décor products for a new account. They pick the items in Zap's catalogue builder and click "Export to PDF" — the formatted, branded document is ready in seconds.

### 5. Label Generation
Generate print-ready barcode labels (EAN-13 or Code-128) for any product or batch of boxes. Labels include all legally required fields: brand, MRP, manufacturer, country of origin, and more.

**Example:** Before dispatching a consignment of 200 boxes to a warehouse, the ops team enters the box range (e.g. 121–320) in Zap and downloads a single PDF with 200 labelled pages — one per box — ready to print.

### 6. Vendors
A managed directory of all suppliers and manufacturers. Vendor records include contact details, linked SKUs, and PO history.

### 7. Warehouses and Bins
The map of all storage locations — which warehouse holds which product, and in which bin. Helps warehouse teams locate stock quickly.

### 8. Forms, Focus Lists, and Bulk Operations
Operational checklists (Forms), personal shortlists of SKUs to watch (Focus Lists), and tools to import or export large data sets in one go (Bulk Ops).

---

## How does Zap connect to other systems?

Zap works alongside the company's existing ERP (called **eAutomate**). The relationship is:

```
eAutomate (ERP reference)
      ↓ sync / mirror
     Zap (operations platform)
      ↓ display + action
  Teams (browser or mobile app)
```

- eAutomate remains the **source of record** for vendor and order data.
- Zap **copies and enriches** that data into a fast, team-friendly interface.
- Local actions in Zap (such as acknowledging an order or generating labels) **do not** depend on eAutomate being available — reducing operational downtime.

---

## The mobile app — Zap Ops

Zap has a companion **React Native mobile app** for warehouse and field teams. It connects to the same data and enforces the same access controls as the web app, making it easy to check stock, GRNs, or orders from the warehouse floor.

---

## Key principles Zap is built on

1. **Single source of truth** — all data lives in one database, not scattered across spreadsheets.
2. **Role-based access** — every user only sees what their job requires.
3. **No single point of failure** — critical workflows (labels, reports, order ack) work locally, even if the ERP is unavailable.
4. **Audit trail** — key actions are logged for compliance and review.

---

*Continue reading:* [Getting Started](getting-started.md) | [Roles and Access](roles-and-access.md) | [Inbound Operations](modules/inbound.md)
