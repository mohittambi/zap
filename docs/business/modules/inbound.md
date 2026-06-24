# Inbound Operations

**Audience:** Operations, Warehouse, Finance, Procurement  
**Plain-language guide to:** Receiving goods from vendors, managing GRNs, handling invoices and notes

---

## What is "inbound"?

In supply chain terms, **inbound** refers to everything that comes *into* your business from a vendor or supplier — physical goods, invoices, and any associated paperwork.

Zap's inbound module covers the full journey from the moment a Purchase Order is sent to a vendor, all the way until the goods are received, verified, invoiced, and settled.

---

## The Inbound Journey — Step by Step

**Canonical reference (routes, APIs, roles):** [Inbound journey](../../inbound-journey.md)

```
Step 1: Purchase Order raised
        (sent to vendor by Procurement)
             ↓
Step 2: Vendor ships goods
             ↓
Step 3: Goods arrive at warehouse
             ↓
Step 4: GRN raised in Zap
        (quantities and SKUs checked)
             ↓
Step 5: Invoice received from vendor
        (uploaded and linked to GRN)
             ↓
Step 6: Finance reviews and settles
        (or raises a Debit Note for discrepancies)
             ↓
Step 7: Records closed in Zap
```

---

## Key terms explained

| Term | What it means in plain English |
|------|-------------------------------|
| **Purchase Order (PO)** | A formal order your company sends to a supplier asking them to deliver specific products |
| **GRN (Goods Receipt Note)** | A document created when goods physically arrive — confirms what was received, in what quantity, and in what condition |
| **Line item** | A single SKU/product in the PO or GRN (e.g. "100 units of SKU XYZ") |
| **Invoice** | The vendor's bill for the goods supplied |
| **Debit Note** | A document your company raises against the vendor when goods are short, damaged, or returned — reducing what is owed |
| **Credit Note** | A document the vendor raises in your favour, also reducing the amount owed |
| **Queue** | A collection of POs or GRNs grouped for a team to work through (e.g. "Items to receive today") |

---

## Real-world example: Receiving a vendor shipment

> **Scenario:** You ordered 1,000 units of a kitchen tool from Vendor A across 5 SKUs. The truck arrives on Thursday.

1. The warehouse team opens Zap and finds the inbound PO for Vendor A.
2. They create a **GRN** against that PO, entering the actual quantity received for each SKU.
3. While unloading, they notice 50 units of one SKU are damaged. They record this in the GRN as a "short receipt."
4. The vendor's invoice arrives by email — it is uploaded directly into the GRN in Zap.
5. Finance reviews the GRN + invoice. Because of the 50 damaged units, they raise a **Debit Note** against Vendor A for the value of those units.
6. The GRN is marked settled. All records — receipt, invoice, debit note — are visible to authorised team members at any time.

---

## What you can do in the Inbound module

### View all incoming Purchase Orders
- See a searchable, filterable list of all POs sent to vendors
- Filter by vendor, status, date range, or PO number
- Click any PO to see its full details, line items, and associated documents

### Manage GRNs
- Create a new GRN against an existing PO
- Enter received quantities SKU by SKU
- Flag damaged, missing, or excess items

### Audit controls
- Completing the audit (marking a GRN as audited) is an **administrator-only** action with a confirmation step in the web UI
- After audit, receipt line data is **locked** and cannot be changed
- If audited prices differ from vendor prices, the system can **automatically generate** a rate-diff debit note

### Upload documents
- Attach vendor invoices directly to a GRN
- Upload signed delivery challans or any other paperwork
- Download uploaded files at any time

### Raise and manage Debit/Credit Notes
- Create a debit note when goods are short or returned
- Track open vs settled notes

### Work with Queues
- Queues are ordered worklists — teams use them to prioritise which POs or GRNs to process first
- A queue might represent "all goods arriving this week" or "all GRNs pending invoice"

---

## Status flow for an inbound PO

| Status | Meaning |
|--------|---------|
| **Open** | PO has been sent to the vendor; awaiting delivery |
| **Partially Received** | Some goods have arrived; GRN raised but not complete |
| **Received** | All goods received; GRN complete |
| **Invoiced** | Vendor invoice received and linked |
| **Settled** | Invoice matched, debit/credit notes resolved, records closed |
| **Cancelled** | PO was cancelled before delivery |

---

## Who handles inbound in Zap?

| Team | What they do |
|------|-------------|
| **Procurement** | Creates POs (or they are synced in from eAutomate) |
| **Warehouse team** | Physically receives goods and raises GRNs |
| **Audit (administrators)** | Verify invoices, enter audited prices, mark GRNs as audited |
| **Finance** | Reviews invoices, raises debit/credit notes, settles accounts |
| **Operations managers** | Monitor overall inbound flow, queue management |

---

## Key reports available

| Report | What it shows |
|--------|--------------|
| **SKU Pendency Report** | Which SKUs are still expected (ordered but not received) |
| **GRN Summary** | All GRNs raised in a period with quantities and values |
| **Debit/Credit Note Log** | All outstanding and settled notes by vendor |

---

*Back to:* [Business Documentation Index](../index.md)  
*Next:* [Outbound Operations](outbound.md)
