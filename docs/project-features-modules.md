# Zap — Product Features and Modules

| | |
|---|---|
| **Document type** | Product Feature Reference |
| **Audience** | Product Owner, Business Stakeholders, Operations Leadership |
| **Maintained by** | Engineering Team |

---

## Executive Summary

**Zap** is an internal operations web application that gives teams a single, unified place to manage product listings, inventory, vendors, purchase orders, catalogues, labels, warehouses, and forms. It connects to the company's eAutomate infrastructure and brings all key operational workflows under one modern, access-controlled interface.

Core areas — listings, inventory, catalogues, vendors, warehouses, forms, and inbound/outbound purchase order views — are fully operational. Several logistics sub-workflows (GRNs, audits, new PO creation, PO detail) are part of the product plan and are currently in development.

---

## 1. What Zap Does

Zap replaces manual, fragmented processes by providing:

- A **searchable listing and inventory hub** — SKU details, bin placement, stock levels, analytics, and summaries in one place.
- **Catalogue management** — build, manage, and share standard or custom product catalogues with export to PDF and Excel.
- **Inbound and outbound purchase order tracking** — visibility into vendor POs coming in and fulfilment orders going out.
- **Label generation** — upload label data and receive print-ready PDFs with barcodes, without needing separate design tools.
- **Vendor and warehouse master data** — a managed directory of vendors, warehouses, and storage bins.
- **Operational forms** — structured form definitions with response tracking.
- **Bulk data operations** — import and export data in bulk via CSV for fast onboarding and updates.
- **Role-based access control** — every user sees and can do only what their role permits.

---

## 2. How the Product is Structured

Zap is delivered as a **single web application** — one URL for the team to use in the browser, with the same system accessible to other tools via a secure API.

```
  +----------------------------------------------------------+
  |                        Z A P                            |
  |                                                         |
  |  Browser (Team)  --->  Screens & Dashboards             |
  |                               |                         |
  |  Systems & Tools --->  Secure API (same data)           |
  |                               |                         |
  |                        +--------------+                 |
  |                        |   Database   |                 |
  |                        +--------------+                 |
  |                               |                         |
  |              eAutomate connection (when configured)     |
  +----------------------------------------------------------+
```

| Layer | What it means for the business |
|---|---|
| **Web screens** | What your team opens in a browser every day — grids, detail pages, upload flows, catalogues. |
| **Secure API** | Other internal tools or automations can read and write data through the same system, with the same access rules. |
| **Database** | A single source of truth for all Zap-owned data — listings, vendors, catalogues, purchase orders, permissions, and more. |
| **Roles and permissions** | Every action (view, edit, export) is controlled per user role. No accidental overwrites. |
| **eAutomate link** | When configured, Zap can pull live inbound data and sync vendor and PO records from eAutomate. |

---

## 3. Product Modules — Summary

| Module | What it delivers |
|---|---|
| Sign-in and access control | Secure login, user roles, and granular permissions |
| Listings and inventory | Full SKU search, detail view, analytics, and inventory summaries |
| Secondary listings and packs/combos | Extended product views and pack/combo relationships |
| Vendors | Vendor directory, detail pages, and SKU-vendor links |
| Warehouses and bins | Storage master data with filters |
| Forms | Form browsing, definitions, and response reading |
| Focus lists | Personal and shared SKU shortlists for operational focus |
| Catalogues | Standard and custom catalogues, builder, and exports (PDF/Excel) |
| Company–SKU relations | Link companies to secondary SKUs |
| Labels master and PDF generation | Label data grid and print-ready barcode PDF output |
| Bulk import and export | CSV-based operations for multiple data types |
| Inbound logistics — PO list and vendor POs | Inbound PO browsing and vendor-scoped views |
| Inbound logistics — SKU-wise live view | Real-time lot-listing search via eAutomate |
| Outbound logistics — PO list and WIP | Outbound PO headers with search and WIP filter |
| Warehouse inventory log | Inventory movement and dump operational view |
| Inbound — GRNs, audits, invoices, debit/credit | Goods receipt and post-PO workflows *(in development)* |
| Outbound — PO detail | Full PO drill-down with line items and documents *(in development)* |
| Outbound — New PO, partial, consignments, boxes | PO creation and fulfilment sub-workflows *(in development)* |
| Forms — Submit flow | User-facing form submission *(scope to be confirmed)* |

---

## 4. Feature Details

### 4.1 Sign-in, Identity, and Access Control

Users sign in with **email and password**. Integrating systems authenticate with a **secure API key**. Every screen and action is protected by **role-based permissions** — for example, only authorised users can create vendors or generate label PDFs.

Any new feature introduced to the product needs a defined permission design before it ships: who can view it, who can act on it.

---

### 4.2 Listings and Inventory

The core module of Zap. Teams can:

- Search and browse all **SKUs** with pagination and keyword filters.
- Open a **SKU detail page** showing bin placement, associated warehouses, inbound summary, incoming quantity, outbound summary, and purchase order line details.
- View **SKU-level analytics**.
- Browse **pack and combo relationships** at the SKU level.
- Access a **warehouse inventory dump** per SKU.

*Designed for: Operations and merchandising teams who need reliable, SKU-level truth in one place.*

---

### 4.3 Secondary Listings and Packs/Combos

Paginated views of **secondary product listings** and **packs/combos**, with SKU-wise detail drill-down. These are accessible under Listings & Inventory and through legacy inventory screens for backwards compatibility.

---

### 4.4 Vendors

- Browse the full **vendor directory**.
- Open a **vendor detail** page.
- See all **SKUs linked to a vendor**, and all **vendors associated with a given SKU**.
- Create new vendors via the system API.

Vendor pages also appear in the **Inbound** section for logistics context.

---

### 4.5 Warehouses and Bins

Master data for the company's storage locations:

- Browse and filter **warehouses**.
- Browse and filter **bins**, with the ability to narrow by warehouse or by SKU.

---

### 4.6 Forms

- Browse **form categories and sub-categories**.
- Read **form definitions**.
- View **responses** for a given form, including the current user's submission for today.

> **Note for product owner:** End-user form submission via the application should be confirmed with the engineering team — the read path is available today; the submit path scope is open.

---

### 4.7 Focus Lists

Users and teams can create and manage **named SKU shortlists** — for example, "priority SKUs this week" or a vendor-specific focus list. Lists can be set as public or private. Accessible under Listings & Inventory → Focus.

---

### 4.8 Catalogues

A full catalogue management system:

- Create and manage **Standard** and **Custom** catalogues.
- Add, remove, and organise **items** within each catalogue.
- **Bulk import** catalogue items via CSV.
- Export a catalogue as a **PDF** (with selectable design themes) or **Excel workbook**.
- Use the **Catalogue Builder** — an interactive grid for assembling standard catalogues item by item.

Catalogue design themes are managed as configurable templates.

---

### 4.9 Company and SKU Relations

Maintains the relationship between **companies** and **secondary SKUs**, with search and pagination. Accessible under Listings & Inventory → Company–SKU.

---

### 4.10 Labels — Master Data and PDF Generation

Two related capabilities:

1. **Labels master** — a searchable, paginated grid of master label records.
2. **Label PDF generation** — upload a CSV of label data and receive a print-ready PDF with barcode formatting (EAN-13 or Code 128, fixed dimensions). Restricted to authorised users.

Print layout and barcode rules are fixed by the label format specification and should be tested against real samples before any template change is deployed.

---

### 4.11 Bulk Import and Export

Efficient data operations at scale for teams managing large product sets:

| Direction | Data types |
|---|---|
| **Export (CSV download)** | Secondary listings, packs/combos, AIS listings, master SKU details |
| **Import (CSV upload)** | Secondary listings, packs/combos, AIS listings |

Accessible under Listings & Inventory → Bulk.

---

### 4.12 Inbound Logistics

Manages the buying side — purchase orders from vendors arriving into the business.

| Capability | Description |
|---|---|
| **Inbound PO list** | Browse and filter all inbound purchase orders in Zap, with vendor, keyword, page, and count filters. |
| **Vendor-scoped PO list** | View POs for a specific vendor; create a new vendor PO. |
| **SKU-wise live view** | When eAutomate is configured, Zap shows real-time inbound lot-listing data by SKU. |
| **Vendor and PO sync** | Operations can run a sync to pull the vendor directory and vendor POs from eAutomate into Zap's database. |

Inbound sub-pages for GRNs, pending audits, pending invoice collection, and pending debit/credit are part of the planned product and are currently in development.

---

### 4.13 Outbound Logistics

Manages the selling side — purchase orders sent to customers or fulfilment partners.

**Cross-cutting plan:** end-to-end warehouse → PO → dispatch → accounting pipeline, validation gates, and phased delivery are documented in [warehouse-inventory-po-pipeline-plan.md](./warehouse-inventory-po-pipeline-plan.md).

| Capability | Description |
|---|---|
| **All outbound POs** | Paginated list of outbound PO headers with keyword search. |
| **WIP filter** | Filter the list to show only Purchase Orders currently in progress. |

Purchase order detail (line items, documents, fulfilment actions) and PO creation workflows are part of the planned product and are currently in development.

---

### 4.14 Purchase Orders (Listing View)

A separate entry point under **More → Purchase orders** for listing-side PO information — distinct from the Inbound and Outbound logistics navigation. This naming overlap between the three entry points is worth addressing in onboarding and user training materials.

---

### 4.15 Warehouse Inventory Log

An operational view over inventory movement and dump data, aligned with the warehouse and listing modules. Accessible under More → Warehouse inventory log.

---

## 5. What is in Development

The following areas are visible in the navigation and are part of the product plan. They are currently being built.

| Area | Description |
|---|---|
| **Inbound — All GRNs (Goods Receipt Notes)** | Listing and filtering of goods receipt notes across vendors. |
| **Inbound — Pending audits** | Audit tracking workflow for inbound POs. |
| **Inbound — Pending invoice collection** | View and manage invoices awaiting collection after goods receipt. |
| **Inbound — Pending debit/credit notes** | Debit and credit note management following PO reconciliation. |
| **Outbound — Purchase order detail** | Full PO drill-down showing line items, documents, and fulfilment actions. |
| **Outbound — Add new purchase order** | Workflow to create a new outbound PO within Zap. |
| **Outbound — Partial shipments** | Track and manage partial shipment against a PO. |
| **Outbound — Consignments** | Consignment management sub-workflow. |
| **Outbound — Manage boxes** | Box and packaging management for outbound fulfilment. |
| **Outbound — Pending invoices** | Invoices pending against outbound POs. |
| **Forms — Submit flow** | Allow users to complete and submit operational forms directly in Zap. |

---

## 6. Key Considerations for Product Planning

### 6.1 Access Control

Every new screen or capability needs a role and permission decision before it ships:
- Who can view it?
- Who can create, edit, or delete?
- Which existing roles need to be updated?

This applies equally to new UI screens and API integrations.

---

### 6.2 eAutomate Dependency

The SKU-wise inbound view and vendor/PO sync rely on a valid, active connection to eAutomate.

Risks to plan for:

- eAutomate session credentials expire — sync jobs will fail if not actively monitored.
- Changes to eAutomate's API structure can break Zap's integration without advance notice.
- If the eAutomate connection is not configured, affected features return a clear error message.

**Recommendation:** Establish a runbook for eAutomate credential rotation and monitor sync job outcomes on a regular schedule.

---

### 6.3 PDF and Label Formatting

Catalogue PDFs and label PDFs use strictly defined formats — fixed dimensions, barcode placement, rotation, and margin rules. Changes to templates or to the underlying PDF generation library risk breaking print operations.

**Recommendation:** Always regression-test with real label and catalogue samples before any release that touches the export or label system.

---

### 6.4 Database Changes with New Features

New features almost always involve database schema changes. These are applied in a controlled, sequential order and must be planned with engineering ahead of any production deployment. Production database changes require a deliberate, reviewed step — they do not happen automatically during a release.

---

### 6.5 Integration Documentation

Zap exposes a full API for systems integration. The current API testing collection covers an earlier subset of available capabilities (listings, analytics, vendors, inventory, forms, warehouses, bins) and does not yet cover newer areas such as catalogues, focus lists, bulk, labels, and inbound/outbound PO APIs.

**Recommendation:** Before committing to any system integration, confirm with engineering which capabilities are available and production-ready.

---

### 6.6 Quality Assurance

Current automated testing covers core business rules — access control, pagination, and error handling — and a basic end-to-end smoke path. It does not cover every screen and user journey.

**For major releases** (especially logistics and catalogue workflows): plan structured User Acceptance Testing with real users before go-live.

---

### 6.7 Security Practices

- Credentials (passwords, API keys, database connection strings) must not appear in shared documents, chat, or tickets.
- API keys issued to integrated systems should be treated as service account credentials — with a known owner, formal issuance, and a regular rotation schedule.
- Production deployments follow a reviewed, controlled process.

---

## 7. Recommended Next Steps

| Priority | Action |
|---|---|
| High | Define requirements for and implement the outbound PO detail view (line items, documents, fulfilment). |
| High | Confirm the scope of the forms submit flow and either ship or formally defer it. |
| High | Review all in-development menu items currently visible to users and decide on implementation timelines. |
| Medium | Clarify the naming and positioning of the three purchase order entry points (More menu, Inbound, Outbound) in training materials. |
| Medium | Update API documentation to cover all current capabilities, especially catalogues, labels, bulk, and logistics. |
| Medium | Establish a runbook and monitoring approach for eAutomate credential management and sync jobs. |
| Low | Invest in end-to-end browser test automation for the highest-value user flows (login, listings, catalogue builder, outbound PO list). |

---

## 8. Glossary

| Term | Definition |
|---|---|
| **SKU** | Stock Keeping Unit — a unique identifier for a product or listing. |
| **PO / Purchase Order** | A formal order placed between buyer and seller. Zap tracks both inbound (vendor to us) and outbound (us to customer). |
| **GRN** | Goods Receipt Note — the formal acknowledgement that ordered goods have been physically received. |
| **WIP** | Work In Progress — a PO that is currently being processed or fulfilled. |
| **Catalogue** | A curated list of products shared with a customer or channel partner, available in exportable formats. |
| **Focus list** | A user-curated shortlist of SKUs assembled for a specific operational purpose. |
| **Bin** | A physical storage slot within a warehouse, mapped to specific SKUs. |
| **eAutomate** | The upstream system Zap connects to for live inbound data and sync operations (when configured). |
| **RBAC** | Role-Based Access Control — the permission system that governs what each user can see and do. |
| **API** | Application Programming Interface — the mechanism by which other systems communicate with Zap programmatically. |
| **CSV** | Comma-Separated Values — a spreadsheet-compatible file format used for bulk data import and export. |
| **AIS listings** | A specific category of product listing data managed within the Zap system. |

---

## 9. Contact and Escalation

| Question type | Who to contact |
|---|---|
| What a feature does or should do | Product Owner |
| Implementation status or timeline | Engineering Lead |
| Access, permissions, or user account setup | Engineering / Operations |
| eAutomate integration or sync status | Engineering and Operations |
| Bug reports or incorrect behaviour | Engineering |

---

*This document reflects the product at the time of last review. It should be updated when major modules ship, change scope, or are retired. Technical implementation detail (API specifications, database schemas, migration history) is maintained separately by the engineering team.*
