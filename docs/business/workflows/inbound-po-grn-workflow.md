# Inbound PO and GRN workflow

**Audience:** Operations, warehouse, audit, accounts, procurement  
**System of record:** Zap PostgreSQL (`/inbound/*`)

This document describes how purchase orders and GRNs move through Zap for **Zap-created** and **eAutomate-imported** records.

---

## Two origins

| Origin | PO label | GRN label | How it arrives |
|--------|----------|-----------|----------------|
| **Zap** | `ZP-{id}` | `ZG-{id}` | Created in Zap UI; never exists in eAutomate |
| **eAutomate** | `{id}` | `{id}` | Imported by `npm run sync:*` scripts |

Both follow the **same workflow** once the record exists in Zap. Zap owns all status transitions and queues (doctrine #10).

---

## End-to-end steps

| Step | Team | Action | Notes | Confirmation |
|------|------|--------|-------|--------------|
| 1 | Procurement | Raise or monitor PO | — | No |
| 2 | Warehouse | Open GRN on PO (invoice #, box counts) | Modal shows PO context and lines to be seeded; invoice # is not copied from prior GRNs | No |
| 3 | Warehouse | Enter quantities per SKU line | — | No |
| 4 | Warehouse | Upload vendor invoice (JPG/PDF) | — | No |
| 5 | Warehouse | **Close GRN** | — | **Yes** |
| 6 | Audit (admin) | Enter audit prices; **mark audit closed** | — | **Yes** |
| 7 | Accounts | Mark physical invoice **collected** | — | **Yes** |
| 8 | Accounts (admin) | **Approve or reject** accounts | — | **Yes** |
| 9 | Finance | Debit/credit note if rate or receipt issue | Regenerate | **Yes** |
| 10 | Warehouse | Receive into inventory (after accounts approved) | Per UI | Per UI |

**Invoice before close:** `POST …/close` fails until at least one vendor invoice file is on the GRN.

**After audit close:** GRN line quantities and prices are **locked**.

---

## PO actions

| Action | Allowed when | Notes |
|--------|--------------|-------|
| **Modify PO notes** | Always (unless PO cancelled) | Updates `zap_notes` only — does not change SKU lines |
| **Cancel PO** | Before goods receipt starts | Blocked if any linked GRN is OPEN/CLOSED, audited, has receipt qty, or accounts progressed |
| **Generate PO document** | Any time | PDF/Excel from canonical PO data |

---

## GRN status machine (Zap)

```
DRAFT_ZAP → OPEN → CLOSED
                ↓
         Pending Audit → Audit CLOSED
                ↓
         Invoice COLLECTED → Accounts APPROVED/REJECTED
```

eAutomate-imported GRNs may arrive with statuses already set; Zap still drives forward transitions from the UI.

---

## Confirmations (standard)

Destructive or terminal actions use an explicit confirmation dialog (`AlertDialog` or dedicated confirm UI) — not `window.confirm`. The API enforces the same business rules server-side.

| Action | Who | UI | Server |
|--------|-----|-----|--------|
| Close GRN | Warehouse | Confirm on GRN detail | Invoice required; status OPEN |
| Mark audit closed | Admin | Confirm on pending audits / GRN | Lines locked after |
| Accounts approve/reject | Admin | Confirm | Queue transition |
| Cancel PO | Procurement | Confirm; disabled when blocked | `assertPoCancellable` → 409 |
| Force regenerate debit note | Accounts | `AlertDialog` on GRN detail | Validation |
| Register operational GRN id | Warehouse | `AlertDialog` on GRN detail | DRAFT_ZAP only |

See also: [inbound-activity-log.md](inbound-activity-log.md), [inbound-field-calibration.md](inbound-field-calibration.md).

---

## Data calibration (Zap POs)

Warehouse line edits on a GRN flow through Postgres in this order:

1. `inbound_grn_items` — canonical line quantities
2. `inbound_grns` — GRN card totals (`recalculateGrnHeaderTotals`)
3. `vendor_purchase_orders` — PO summary KPIs (`recalculatePoHeaderTotals`, Zap source only)

**KPI definitions:** `quantity_fill_rate` = accepted qty ÷ ordered qty (percentage). `sku_fill_rate` = count of SKUs with any accepted qty ÷ total SKUs on the PO (percentage). Values match eAutomate semantics.

Visual flow: [Process flows UI](/flows) → **GRN Totals & PO Calibration**.

---

## Related

- [Inbound journey](../../inbound-journey.md)
- [Field calibration](inbound-field-calibration.md)
- [Process flows UI](/flows)
