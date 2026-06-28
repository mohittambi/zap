# Insights & Decision Intelligence

**Audience:** Administrators, Operations leadership, Finance  
**Plain-language guide to:** Turning Zap's operational data into ranked, actionable recommendations

---

## What is the Insights hub?

The **Insights hub** sits on top of data Zap already collects — sales, inbound GRNs, inventory, vendor quality, and queue backlogs. It does **not** replace the home dashboard; it adds a **decision layer** that answers: *what should we do next, and why?*

Think of it as a **prioritized worklist** for administrators, with drill-down into SKUs, vendors, and operational queues.

---

## What you can do

| Area | What Insights shows | Example action |
|------|---------------------|----------------|
| **Overview** | Ranked recommendations across inventory, procurement, and sales | Reorder a stockout-risk SKU |
| **Segmentation** | ABC/XYZ SKU classes and suggested policies | Tighten reorder on A/X movers |
| **Vendor scores** | Reliability 0–100 from acceptance, shortage, debit notes | Review a high-risk vendor |
| **Working capital** | Capital tied, dead-stock value, days inventory outstanding | Liquidate slow movers |
| **Forecasting** | Per-SKU demand forecast + safety stock / EOQ | Order the smart quantity |
| **Settings** | Severity weights, thresholds, digest toggle | Tune ranking for your business |

---

## Real-world example

> **Scenario:** Sales are strong but fill rate dropped 4% month-over-month, three SKUs are below reorder point, and the audit queue has 12 GRNs waiting.

1. Open **Insights → Overview**.
2. Top items might include: *Fill rate declining*, *Stockout risk: SKU-X*, *Pending audits backlog*.
3. Click through to the SKU listing or inbound pending-audits queue.
4. **Snooze** an insight you are already handling; **Dismiss** one that does not apply.
5. **Save digest** to capture a snapshot for weekly leadership review.

---

## Who can access Insights?

**Administrators only.** The nav group is hidden for warehouse, viewer, and vendor roles. API routes require the `insights:read` or `insights:manage` permission (granted via admin wildcard).

---

## How it connects to the rest of Zap

```
Home dashboard (BI)     →  descriptive KPIs, trends, anomalies
        ↓
Insights hub (DI)       →  ranked recommendations + drill-down
        ↓
Operational modules   →  reorder, inbound queues, listings, vendors
```

---

*Back to:* [Business Documentation Index](../index.md)
