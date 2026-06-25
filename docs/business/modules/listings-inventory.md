# Listings and Inventory

**Audience:** Merchandising, Category, Operations, Warehouse  
**Plain-language guide to:** Product catalogue management, SKU details, and stock tracking

---

## What is "listings and inventory"?

A **listing** is Zap's record for a single product variant — everything the business needs to know about that product in one place: its name, barcode, dimensions, pricing, images, warehouse location, and current stock level.

**Inventory** refers to the actual physical stock count — how many units of each product are currently held in which warehouse or bin.

Together, listings and inventory give every team a **single, reliable answer** to the question: *"What do we have, where is it, and what does it look like?"*

---

## Real-world example: Looking up a product

> **Scenario:** A Key Account Manager is on a call with a buyer who asks about the dimensions and current stock of a kitchen storage set (SKU: KSS-001).

Without Zap, the KAM would need to email the warehouse, wait for a reply, and check a separate spreadsheet for pricing.

With Zap:
1. The KAM searches "KSS-001" in the Listings module — result appears instantly.
2. The listing shows: product name, images, dimensions (L × W × H), weight, MRP, HSN code, and current stock split by warehouse.
3. The KAM shares the relevant details with the buyer in under 60 seconds.

---

## What is stored on each product listing?

| Field | What it tells you |
|-------|------------------|
| **SKU / Article code** | Unique identifier for this product variant |
| **Product name** | Full name, including variant details (e.g. "Blue, 3-piece set") |
| **Brand** | The selling brand |
| **Category / Sub-category** | Where the product fits in the product tree |
| **EAN / Barcode** | The 13-digit global barcode used for scanning and labelling |
| **MRP** | Maximum Retail Price (used on product labels) |
| **Dimensions and weight** | Useful for logistics costing and box packing |
| **Images** | Product photography linked to the listing |
| **Country of origin** | Required for legal labelling |
| **Manufacturer details** | Name and address for the product label |
| **Bin location** | Which aisle/shelf/bin in the warehouse holds this SKU |
| **Stock level** | Quantity on hand, by warehouse |

---

## Understanding stock levels

Zap tracks inventory across multiple warehouses. For each SKU you can see:

- **Quantity on hand** — units physically present
- **Inbound pending** — units on order from vendors (not yet received)
- **Outbound pending** — units committed to channel orders (not yet dispatched)
- **Net available** — on hand minus outbound pending

> **Example:** SKU A has 500 units on hand, 200 committed to a Blinkit PO, and 100 more arriving from a vendor. Net available = 300 units (500 – 200).

---

## What you can do in Listings and Inventory

### Search and browse products
- Full-text search by product name, SKU, EAN, or brand
- Filter by category, warehouse, or stock status
- Paginated results for large catalogues (thousands of SKUs)

### View a product detail page
- All fields described above, including images
- Stock level breakdown per warehouse
- Linked inbound and outbound POs

### Edit product details
- Update dimensions, pricing, bin location, or other fields where the API allows
- Product images: five URL slots per SKU (`img_hd`, `img_white`, etc.). **Today** these are synced from eAutomate/CDN. **Planned:** all images hosted in Zap Storage (see [listing-image-storage skill](../../.cursor/skills/listing-image-storage/SKILL.md) — built, not yet activated).

### Export listings
- Download a filtered set of listings to Excel
- Use in pricing discussions, catalogue creation, or reporting

### Bulk import
- Upload a spreadsheet to create or update multiple listings at once (see [Bulk Operations](bulk-ops.md))

---

## How listings connect to the rest of Zap

```
Product Listing (SKU master)
     ↕
Inbound PO → GRN → Stock increases
     ↕
Outbound PO → Dispatch → Stock decreases
     ↕
Labels module → Product stickers generated from listing data
     ↕
Catalogue builder → Marketing catalogue uses listing images + fields
```

Listings are the foundation that every other module depends on. Keeping listings accurate and complete ensures that reports, labels, and catalogues all have correct, up-to-date information.

---

## Company–SKU relationships

Zap tracks which SKUs are approved or associated with which companies (buyers). This helps teams:
- Know which products are in-scope for a specific channel
- Filter the catalogue to a particular buyer's assortment
- Manage exclusive or restricted SKUs

---

## Stock accuracy tips

| Good practice | Why it matters |
|---------------|----------------|
| Raise a GRN immediately when goods arrive | Keeps stock counts current |
| Mark a consignment as dispatched on the day of shipping | Avoids phantom stock showing as available |
| Use bin locations consistently | Makes warehouse searches faster and reduces picking errors |
| Investigate discrepancies promptly | Small mismatches compound over time |

---

*Back to:* [Business Documentation Index](../index.md)  
*Previous:* [Outbound Operations](outbound.md)  
*Next:* [Catalogues and Exports](catalogue-and-labels.md)
