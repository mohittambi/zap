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

| Step | Team | Action | Confirmation required? |
|------|------|--------|------------------------|
| 1 | Procurement | Raise or monitor PO | No |
| 2 | Warehouse | Open GRN on PO (invoice #, box counts) | No |
| 3 | Warehouse | Enter quantities per SKU line | No |
| 4 | Warehouse | Upload vendor invoice (JPG/PDF) | No |
| 5 | Warehouse | **Close GRN** | **Yes** |
| 6 | Audit (admin) | Enter audit prices; **mark audit closed** | **Yes** |
| 7 | Accounts | Mark physical invoice **collected** | **Yes** |
| 8 | Accounts (admin) | **Approve or reject** accounts | **Yes** |
| 9 | Finance | Debit/credit note if rate or receipt issue | Regenerate: **Yes** |
| 10 | Warehouse | Receive into inventory (after accounts approved) | Per UI |

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

Destructive or terminal actions use an explicit confirmation dialog in the web UI. The API enforces the same business rules server-side.

See also: [inbound-activity-log.md](inbound-activity-log.md), [inbound-field-calibration.md](inbound-field-calibration.md).

---

## Related

- [Inbound journey](../../inbound-journey.md)
- [Field calibration](inbound-field-calibration.md)
- [Process flows UI](/flows)
