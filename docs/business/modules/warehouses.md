# Warehouses and Storage Locations

**Audience:** Warehouse managers, Operations, Logistics  
**Plain-language guide to:** Managing warehouses, bins, and storage locations in Zap

---

## What is the Warehouse module?

The **Warehouse module** provides a structured map of all physical storage locations used by the business. It tracks which products are stored where, down to the individual **bin** level.

A **bin** is the smallest identifiable storage location inside a warehouse — typically a shelf position identified by an aisle letter, shelf number, and position (e.g. "B-03-R" = Aisle B, Shelf 3, Right).

---

## Why structured warehouse management matters

| Without structured locations | With Zap warehouse bins |
|-----------------------------|------------------------|
| "It's somewhere in the back" | "SKU XYZ is in Bin B-03-R, Warehouse Pune" |
| New staff take weeks to learn the floor layout | Search by SKU → bin location shown instantly |
| Stock counts require walking the entire floor | Count a specific bin to reconcile a specific SKU |
| Mis-picks and wrong-item shipments | Warehouse team confirms bin before picking |

---

## Real-world example: Finding a product location

> **Scenario:** A warehouse worker needs to pick 50 units of a cleaning product for an urgent outbound order.

1. The supervisor opens the Listings module in Zap and searches for the SKU.
2. The product detail page shows: "Bin C-07-L, Warehouse Mumbai — 280 units available."
3. The worker walks directly to Bin C-07-L and picks 50 units. No searching. No delay.

---

## What you can do in the Warehouse module

- **View all warehouses** — list of all operational locations with addresses
- **Browse bins** — see the full bin structure inside each warehouse
- **Check what is in a bin** — view which SKUs and quantities a specific bin holds
- **Update bin assignments** — move a SKU to a new bin when reorganising the floor
- **Track empty bins** — identify available space for new stock

---

## How warehouses connect to the rest of Zap

```
Warehouse → Bins
     ↕
Product Listings (bin location field)
     ↕
Inbound GRN → goods placed in bin → bin quantity increases
     ↕
Outbound dispatch → goods picked from bin → bin quantity decreases
```

---

*Back to:* [Business Documentation Index](../index.md)
