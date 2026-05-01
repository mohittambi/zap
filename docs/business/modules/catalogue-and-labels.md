# Catalogues, Exports, and Label Generation

**Audience:** Sales, Merchandising, Operations, Logistics  
**Plain-language guide to:** Building product catalogues, exporting them, and printing product labels

---

## Catalogues

### What is the Catalogue module?

The **Catalogue module** allows the team to build and manage structured product catalogues — collections of products organised for a specific purpose, such as a buyer presentation, a seasonal range, or a channel assortment.

Think of a catalogue as a branded, formatted product booklet that can be exported as a PDF or Excel file and shared with buyers, account managers, or internal teams.

---

### Real-world example: Preparing a buyer catalogue

> **Scenario:** The sales team has a pitch meeting with a large retail chain. They want to present 80 home décor products with images, descriptions, and pricing.

**With Zap:**
1. A merchandiser opens the Catalogue module and creates a new catalogue called "Home Décor — Summer 2026."
2. They add 80 SKUs from the listings, with the correct images and pricing pre-filled from the product records.
3. They click "Export to PDF" — a formatted, brand-ready PDF is generated and downloaded in seconds.
4. The sales team takes it to the meeting (or shares it digitally).

Without Zap, this would have taken hours of copying data into a design tool or Excel.

---

### How catalogue creation works — step by step

```
Step 1: Create a new catalogue
        (name it, choose a format/template)
             ↓
Step 2: Add products
        (search your listings and select SKUs)
             ↓
Step 3: Review and arrange
        (reorder items, check images and pricing)
             ↓
Step 4: Export
        (download as PDF or Excel)
             ↓
Step 5: Share
        (email, WhatsApp, printed copy, etc.)
```

---

### What a catalogue page typically includes

| Section | Content |
|---------|---------|
| Product image | High-quality product photograph |
| Product name and variant | Full descriptive name |
| SKU / Article code | For ordering reference |
| MRP | Retail price |
| Dimensions | If relevant to the category |
| Key features | Short bullet points |
| Brand and manufacturer | Company or brand name |

---

## Label Generation

### What are product labels?

**Product labels** are the individual stickers affixed to each unit of a product before it is dispatched. They carry legally mandated information and a scannable barcode that channels and retailers use for their inventory systems.

Zap generates print-ready label PDFs directly from the product's listing data — no separate design software needed.

---

### What appears on a product label?

| Field | Source |
|-------|--------|
| Product name | Listing |
| Brand | Listing |
| MRP (price) | Listing |
| EAN-13 barcode | Listing (auto-rendered as barcode image) |
| Manufacturer name and address | Fixed settings / listing |
| Country of origin | Listing |
| Net weight / quantity | Listing |
| "Best before" / batch code | Entered at generation time (if applicable) |

---

### Real-world example: Printing product labels for an outbound order

> **Scenario:** Blinkit requires product stickers on 1,200 individual units (across 8 SKUs) before acceptance at their warehouse.

1. The ops manager opens the outbound PO in Zap.
2. Clicks **Generate Product Labels** — the 4-step wizard opens.
3. **Step 1 — SKU list:** Zap auto-fetches all SKUs for this PO.
4. **Step 2 — Fixed settings:** Confirm or edit the manufacturer name, address, and other fields that are the same for all SKUs.
5. **Step 3 — Quantities:** For each SKU, enter the number of labels needed (may differ from ordered quantity if some arrive pre-labelled).
6. **Step 4 — Label size:** Choose label size (e.g. 70×40mm or 75×38mm) based on the printing stock available.
7. Click **Generate** — a multi-page PDF is downloaded, one label per page.
8. The warehouse team loads the PDF into the label printer and prints all labels in sequence.

---

### Phase 1 Box Labels

**Box labels** (also called Phase 1 labels) are applied to the outside of each shipping carton. They identify:
- The consignment / PO it belongs to
- The destination company and city
- The box number (e.g. "Box 15 of 60")
- A Code-128 barcode for scanning at the destination warehouse
- The date of packing

#### How to generate box labels

1. Open the outbound PO in Zap.
2. Click **Generate Phase 1 Box Labels**.
3. Enter the box range — from box number to box number (e.g. 1 to 60).
4. Select label size.
5. Click **Generate** — a PDF is downloaded with one label per page.
6. Print and stick one label on each box before dispatch.

---

### Label sizes available

| Size | Typical use |
|------|-------------|
| **70 × 40 mm** | Standard product labels and box labels |
| **75 × 38 mm** | Slightly wider product labels for certain product categories |

---

### Summary: Catalogues vs Labels

| | Catalogues | Product Labels | Box Labels |
|-|-----------|---------------|------------|
| **Purpose** | Buyer presentations, range reviews | Unit-level legal compliance stickers | Shipping carton identification |
| **Generated from** | Selected SKUs + template | Outbound PO line items | Box range entered by ops |
| **Export format** | PDF or Excel | PDF (one label per page) | PDF (one label per page) |
| **Who uses it** | Sales, Merchandising | Warehouse team | Ops / Dispatch |

---

*Back to:* [Business Documentation Index](../index.md)  
*Previous:* [Listings and Inventory](listings-inventory.md)  
*Next:* [Vendors](vendors.md)
