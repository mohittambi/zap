# Inbound GRN, Debit Note & Credit Note Flows

## 1 — GRN Lifecycle

```mermaid
flowchart TD
    PO[PO Generated in eAutomate] --> GRN_OPEN

    GRN_OPEN["GRN Opened
grn_status = OPEN
Source: eAutomate sync"] --> QTY_UPDATE

    QTY_UPDATE["Quantity Update
invoice qty / accepted / rejected / shortage
Source: eAutomate GRN items sync"] --> DN_SHORT{Shortage or
Damage?}

    DN_SHORT -->|Yes| DN_SHORTAGE["eAutomate Debit / Credit Note
shortage · damage · vendor adjustment"]
    DN_SHORT -->|No| CLOSE_GRN

    DN_SHORTAGE --> CLOSE_GRN

    CLOSE_GRN["Close GRN
grn_status = CLOSED
Action: Zap UI — Close GRN button"] --> INV_UPLOAD

    INV_UPLOAD["Invoice Upload
JPG / JPEG / PDF
Action: Zap file upload"] --> PENDING_AUDIT

    PENDING_AUDIT["Pending Audit Queue
inbound_grn_pending_audit
Source: eAutomate sync"] --> AUDIT_ACTION

    AUDIT_ACTION["Audit
grn_audit_status = CLOSED
Action: Audit team in Zap"] --> DN_RATE{Rate
Discrepancy?}

    DN_RATE -->|Yes| DN_ZAP["Zap Debit Note — Rate Diff
DRAFT → ISSUED → EXPORTED → CLOSED"]
    DN_RATE -->|No| INV_COLLECT

    DN_ZAP --> INV_COLLECT

    INV_COLLECT["Physical Invoice Copy Received
grn_invoice_collection_status = COLLECTED
Pending Invoice Collection queue"] --> ACCOUNTS

    ACCOUNTS["Accounts Approval
accounts_status = APPROVED / REJECTED
Action: Accounts team in Zap
Download Invoice Excel available"] --> INV_RECEIPT

    INV_RECEIPT["Inventory Receipt
Map SKU → Bin → Qty
inventory_receipt_status = DONE"]
```

---

## 2 — Zap Debit Note (Rate Discrepancy)

Created inside Zap when the audit price is lower than the vendor's received price.
Lives in `inbound_zap_debit_notes`.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Generate debit note\n(price diff detected on audit)

    DRAFT --> ISSUED : Accounts assigns DN Number
    EXPORTED --> ISSUED : Accounts assigns DN Number

    DRAFT --> EXPORTED : Export Tally CSV
    ISSUED --> EXPORTED : Export Tally CSV

    ISSUED --> CLOSED : Vendor uploads CN Copy
    EXPORTED --> CLOSED : Vendor uploads CN Copy
```

**Status meanings**

| Status | Trigger |
|--------|---------|
| `DRAFT` | Auto-generated on "Generate debit note"; reference = `DN-GRN-{id}-{YYYYMMDD}` |
| `ISSUED` | Accounts team assigns a real DN number in the Zap UI |
| `EXPORTED` | Tally CSV downloaded via debit-note/export |
| `CLOSED` | Vendor CN copy uploaded via cn-copy endpoint |

---

## 3 — eAutomate Credit / Debit Note (Shortage · Damage)

Synced from eAutomate during GRN details ingest.
Lives in `inbound_grn_debit_credit_notes`.

```mermaid
flowchart TD
    EA_SYNC["eAutomate Sync
GRN details ingested"] --> NOTE_EXISTS{DCN on
this GRN?}

    NOTE_EXISTS -->|Yes| NOTE_TYPE{Type}

    NOTE_TYPE -->|Debit Note| DN_EA["Debit Note
DEBIT_NOTE — shortage / damage"]
    NOTE_TYPE -->|Credit Note| CN_EA["Credit Note
CREDIT_NOTE — vendor overpayment"]

    DN_EA --> NUM_ASSIGN{Number
Assigned?}
    CN_EA --> NUM_ASSIGN

    NUM_ASSIGN -->|No| PENDING_DC["Pending Debit & Credit Queue
assignment_status = NOT_ASSIGNED"]
    NUM_ASSIGN -->|Yes| NUM_ASSIGNED["Number set
assignment_status = ASSIGNED"]

    PENDING_DC -->|Number received| NUM_ASSIGNED

    NUM_ASSIGNED --> UPLOAD{File
Uploaded?}

    UPLOAD -->|No| NOT_UPLOADED["upload_status = NOT_UPLOADED"]
    UPLOAD -->|Yes| UPLOADED["upload_status = UPLOADED
uploaded_by set"]

    NOT_UPLOADED -->|Upload in Zap| UPLOADED

    UPLOADED --> REVERSE{Reverse
Note?}
    REVERSE -->|Yes| REV_NOTE["Reverse note number + upload"]
    REVERSE -->|No| SETTLED["Settled ✓"]
    REV_NOTE --> SETTLED
```

**Key fields on `inbound_grn_debit_credit_notes`**

| Field | Purpose |
|-------|---------|
| `credit_debit_note_type` | `DEBIT_NOTE` or `CREDIT_NOTE` |
| `credit_debit_note_number` | Assigned by accounts / vendor |
| `credit_debit_note_number_assignment_status` | `ASSIGNED` / `NOT_ASSIGNED` |
| `credit_debit_note_upload_status` | `UPLOADED` / `NOT_UPLOADED` |
| `reverse_credit_debit_note_number` | Reverse note reference if applicable |

---

## Key Distinction

| | Zap Debit Note | eAutomate DCN |
|---|---|---|
| **Source** | Created in Zap | Synced from eAutomate |
| **Trigger** | Rate discrepancy found at audit | Shortage / damage reported by vendor |
| **Table** | `inbound_zap_debit_notes` | `inbound_grn_debit_credit_notes` |
| **Lifecycle** | DRAFT → ISSUED → EXPORTED → CLOSED | NOT_ASSIGNED → ASSIGNED → UPLOADED |
