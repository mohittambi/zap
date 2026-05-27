# Outbound Operations

**Audience:** Operations, Logistics, Warehouse, Channel Management  
**Plain-language guide to:** Fulfilling channel purchase orders, dispatch, consignments, and label printing

---

## What is "outbound"?

**Outbound** covers everything that goes *out* of your warehouse to a sales channel or buyer — from receiving the channel's purchase order, through packing, labelling, and dispatching the goods.

Your sales channels (e.g. Swiggy Instamart, Blinkit, Zepto, Amazon) place orders for products they want to stock. Zap helps your operations team receive those orders, plan fulfilment, print all necessary labels and documents, and track what has been sent.

---

## The Outbound Journey — Step by Step

**Canonical reference (routes, APIs, pendency PDF):** [Outbound journey](../../outbound-journey.md)

```
Step 1: Channel places a Purchase Order (PO)
        (received from Blinkit, Swiggy, etc.)
             ↓
Step 2: Ops team reviews PO in Zap
        (acknowledgement — "we accept this order")
             ↓
Step 3: Warehouse picks and packs the goods
             ↓
Step 4: Consignment is created
        (a shipment group — e.g. all goods going to Blinkit warehouse B)
             ↓
Step 5: Box labels printed from Zap
        (one barcode label per physical box)
             ↓
Step 6: Product labels printed (if required)
        (individual SKU stickers with EAN barcode, MRP, brand, etc.)
             ↓
Step 7: Goods dispatched; consignment marked sent
             ↓
Step 8: Reports downloaded for records
        (SKU pendency report, dispatch summary)
```

---

## Key terms explained

| Term | What it means |
|------|--------------|
| **Outbound PO** | A purchase order received *from* a sales channel (buyer); the opposite of an inbound PO that you send to a supplier |
| **Acknowledgement** | Confirming to the channel that you have received their PO and will fulfil it |
| **Consignment** | A physical shipment — a group of boxes all going to the same destination at the same time |
| **Box label (Phase 1)** | A barcode label attached to each shipping box, identifying the consignment, box number, and destination |
| **Product label** | A printed sticker placed on individual product units, showing MRP, brand, barcode (EAN-13), manufacturer details, country of origin |
| **SKU pendency** | The list of SKUs in a PO that have not yet been dispatched |
| **Dispatch** | The physical handover of goods to a courier or transport vehicle |

---

## Real-world example: Fulfilling a Blinkit order

> **Scenario:** Blinkit places PO #MBEPO16587 for 2,400 units across 36 product SKUs, to be delivered to their Gurgaon warehouse.

**Day 1 — Order received**
1. The PO automatically syncs into Zap overnight via the eAutomate integration.
2. The ops manager opens Zap, finds PO #MBEPO16587, and clicks **Acknowledge** — this confirms to Blinkit that the order is accepted.
3. The PO status changes to "In Progress."

**Day 2–3 — Warehouse picks and packs**
4. The warehouse team uses the PO detail page in Zap to see all 36 SKUs and quantities.
5. They pack goods into 45 boxes.
6. The ops manager opens the **Generate Phase 1 Box Labels** tool in Zap, enters box range 1–45, selects label size, and downloads a 45-page PDF. Each page is the label for one box. They print and attach the labels.

**Day 4 — Product labelling (if required)**
7. For 8 SKUs that need individual unit stickers (e.g. for MRP or brand stickers), the ops manager opens **Generate Product Labels**, selects those SKUs, enters the quantity per SKU, and downloads the label PDF. The warehouse team prints and sticks them.

**Day 4 — Dispatch**
8. The truck arrives. The warehouse team hands over all 45 boxes.
9. The ops manager updates the consignment status in Zap to "Dispatched."
10. A **SKU Pendency Report** is downloaded for the records — showing which SKUs were fully dispatched vs any shortfall.

---

## What you can do in the Outbound module

### View all outbound Purchase Orders
- Searchable, filterable list of all channel POs
- Filter by channel, status, delivery city, or date
- See at a glance which orders are pending, in progress, or dispatched

### Acknowledge or cancel a PO
- **Acknowledge** — marks the PO as accepted; notifies the ops team to start fulfilment
- **Cancel** — marks the PO as not proceeding; reason is recorded for audit

### Manage consignments
- A consignment groups boxes going to the same destination
- Track packing progress and dispatch date per consignment

### Generate labels

#### Box Labels (Phase 1)
Used for shipping cartons. Each box in a consignment gets its own label printed with:
- The consignment / PO number
- Destination company name and city
- Box number (e.g. "Box 12 of 45")
- A scannable Code-128 barcode
- Date of packing

> To generate: open the PO → click "Generate Phase 1 Box Labels" → enter box range → select label size → download PDF.

#### Product Labels
Used for individual product units. Each label includes:
- Product name and variant
- EAN-13 barcode
- MRP and tax info
- Brand, manufacturer, and country of origin

> To generate: open the PO → click "Generate Product Labels" → confirm fixed fields (brand, manufacturer) → adjust per-SKU quantities → choose label size → download PDF.

### Download reports
- **Pendency PDF** (`download_pendency_pdf`) — open lines with **PO SKU** (channel item code), **Company Code Primary** (warehouse `master_sku` e.g. `AAC500`, EAN, or mappings — not the same as PO SKU), **Warehouse Inventory** (Zap bin stock), **M.R.P**, and **Pending** quantity. Technical detail: [Pendency PDF](../../services/outbound/pendency-pdf.md).
- **SKU Level Report** (`download_sku_report`) — CSV with commercial columns, Master SKU, and GST % for records / accounts.
- **Consignment packing list** — full manifest of a shipment

### Upload original PO files
- Attach the channel's original PO document to the Zap record
- Useful for dispute resolution and audit purposes
- Download at any time

---

## PO status flow

| Status | What it means |
|--------|--------------|
| **Synced / Open** | PO received from channel; awaiting acknowledgement |
| **Acknowledged** | Ops team has confirmed they accept the order |
| **In Progress (WIP)** | Warehouse is picking and packing |
| **Ready to Dispatch** | All boxes packed and labelled; awaiting pickup |
| **Dispatched** | Goods handed to courier or transport |
| **Cancelled** | PO cancelled before dispatch |

---

## Who handles outbound in Zap?

| Team | Responsibility |
|------|---------------|
| **Channel management / Key accounts** | Receives and monitors channel POs |
| **Operations** | Acknowledges POs, manages status updates, generates reports |
| **Warehouse team** | Picks, packs, and dispatches; uses labels printed from Zap |
| **Logistics / Dispatch** | Records dispatch details and closes consignments |

---

## See also (operator & technical)

- [Outbound Tab – Process Notes (ZAP Website)](../../services/outbound/outbound-tab-process-notes.md) — step-by-step checklist aligned to live routes and APIs
- [Pendency PDF — column data](../../services/outbound/pendency-pdf.md)

---

## How Zap connects with the channel's system

Zap syncs PO data from eAutomate automatically. The sync runs on demand or can be triggered by the ops team. This means:
- New channel POs appear in Zap without anyone manually entering them
- Product and vendor data is always up to date
- Historical PO records are preserved even if eAutomate is unavailable

---

*Back to:* [Business Documentation Index](../index.md)  
*Previous:* [Inbound Operations](inbound.md)  
*Next:* [Listings and Inventory](listings-inventory.md)
