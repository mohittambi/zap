# Inbound GRN, Debit Note & Credit Note Flows

**System of record:** Zap (this app’s Postgres, APIs, and UI). Operational truth for inbound workflow—queues, statuses, uploads, approvals, debit/credit artefacts, and rate-diff debit notes—is **persisted and resolved in Zap**, not delegated to external ERP synchronisation.

## 1 — GRN Lifecycle (operator order)

Typical Zap sequence: **receive and edit lines while `OPEN` → attach vendor invoice → close GRN** (invoice required). **Pending Audit** surfaces GRNs from the Zap-maintained **`inbound_grn_pending_audit`** queue; the audit team verifies invoice alignment and enters **`audit_price`** on GRN lines. **Rate-diff Zap debit notes** are raised when discrepancies exist—see §2 for auto-on-close behaviour.

### Summary flow (stakeholder milestones)

Vendor selection → Item selection → **PO creation** → **GRN open** → **Receipt / quantity (and vendor price while OPEN)** → **Operational debit–credit handling** (when there is shortage, damage, or vendor-led adjustment—the **§3 GRN-linked** debit/credit records in Zap) → **GRN closed** → **Vendor invoice uploaded** (*see Zap ordering note*) → **Audit** (pending audit queue; **`audit_price`** on lines) → **Zap rate-diff debit note** (when **`received_price` > `audit_price`** — typically created on **`POST …/close`**, §2) → **Accounts** (approve/reject workflow) → **Physical invoice marked collected** (§1 Accounts — physical invoice) → **Assigned DN number** (when an **§2 Zap** DN exists — §2 “Accounts Team — Zap DN”) → **Invoice + DN Excel** (`GET …/invoice-export`) **Download**.

**Zap ordering:** In product, **`POST …/close` requires vendor invoice PDF already on file**; if your narrative lists *close → upload invoice*, reorder operations so **invoice upload precedes GRN close** in Zap.

**Physical copy vs Accounts:** In Zap, GRNs normally move **pending invoice collection** (physical copy **COLLECTED**) **before** the **accounts approval** outcome on that GRN; your own checklist may phrase “Accounts” broadly—match the Pending Invoice Collection hub and Pending Accounts queues in [`workflows.md`](./services/inbound/workflows.md).

The diagram below is the authoritative **technical** sequencing once PO / GRN exist **in Zap**.

```mermaid
flowchart TD
    PO[PO_and_catalogue_selection_in_Zap] --> GRN_OPEN["GRN_OPEN_or_draft_register"]

    GRN_OPEN --> QTY["Line_qty_prices_WHILE_OPEN_PATCH_items"]

    QTY --> RCP_ISSUE{Receipt_issue_DN_or_credit_path}

    RCP_ISSUE -->|Yes| GRN_DCIN["GRN_linked_DC_and_CN_records"]
    RCP_ISSUE -->|No| INV_UP

    GRN_DCIN --> INV_UP["Vendor_invoice_upload_JPG_JPEG_PDF"]

    INV_UP --> CLOSE_GRN["POST_close_GRN_requires_invoice"]

    CLOSE_GRN --> AUDIT_QUEUE["Pending_Audit_queue_table"]

    AUDIT_QUEUE --> AUDIT_TEAM["Audit_team_invoice_and_rates"]

    AUDIT_TEAM --> RATE_DN{Zap_vendor_price_above_audit_price}

    RATE_DN -->|At_close_or_POST_debit_note| DN_ZAP["Zap_DN_lifecycle"]
    RATE_DN -->|No_delta| SKIP_DN[No_Zap_DN]

    DN_ZAP --> INV_COLL["Invoice_collection_physical_copy"]
    SKIP_DN --> INV_COLL

    INV_COLL --> ACCOUNTS["Accounts_APPROVE_REJECT"]

    ACCOUNTS --> INV_REC["Inventory_receipt_bins"]
```

### Invoice Audit Team

1. **Where they work:** The **Pending Audit** hub at route `/inbound/pending-audits` lists GRNs joined from **`inbound_grn_pending_audit`** with filters in `listPendingAuditGrnsPaginated` ([`inboundGrnsService.ts`](../../src/server/services/inboundGrnsService.ts)). That queue row set is Zap data (see service comments for lifecycle).
2. **What they verify:** Invoice vs receipt; **audit price** (`audit_price` and related keys on each GRN line `raw`) is captured via `PATCH …/items/{lineIndex}` on inbound GRNs ([`updateInboundGrnItemRaw`](../../src/server/services/inboundGrnsService.ts)).
3. **Rate discrepancy DN:** Zap compares **received (vendor) price** vs **audit price** when building lines for `inbound_zap_debit_notes` ([`generateDebitNote`](../../src/server/services/grnDebitNoteService.ts)). This is distinct from receipt-issue debit/credit records in §3.

### Accounts Team — Physical invoice copy

Business wording **Pending Physical Copy Receiving** maps to Zap’s **Pending Invoice Collection** queue (`/inbound/pending-invoice-collection`), backed by **`inbound_grn_pending_invoice_collection`** together with **`inbound_grns`** lifecycle fields—maintained **in Zap** like other inbound queues.

1. **Mark received:** The Accounts team selects rows (bulk or per row) and sets **`grn_invoice_collection_status` to `COLLECTED`** via **`PATCH /api/inbound/grns/{grnId}`** ([`pending-invoice-collection/page.tsx`](../../src/app/%28app%29/%28logistics%29/inbound/pending-invoice-collection/page.tsx)). That completes “physical copy received” in Zap; marking does **not** by itself emit a stored file.

2. **Invoice Excel:** After **`COLLECTED`**, operators download a workbook **on demand** — **Download Invoice Excel** on the GRN **Accounts** tab, or **`GET /api/inbound/grns/{grnId}/invoice-export`** ([`buildInvoiceExcel`](../../src/server/services/grnDebitNoteService.ts)). The export is operator-initiated, not triggered automatically when collection is marked.

---

## 2 — Zap Debit Note (Rate Discrepancy)

**Creation:** Zap writes a row to `inbound_zap_debit_notes` **automatically immediately after a successful `POST …/close`** when at least one line has positive accepted quantity and `received_price > audit_price` (same eligibility as explicit generation, with `force_regenerate: false` on the automatic path). No discrepancy → close still succeeds with no DN. If a **terminal** Zap note already exists (`ISSUED` / `CLOSED`), auto-generation is skipped without failing close (HTTP **409** from `generateDebitNote` is swallowed). Operators may also call **`POST /api/inbound/grns/[grnId]/debit-note`** to generate or regenerate subject to status and optional `force_regenerate`.

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
| `DRAFT` | Auto-created on **`POST …/close`** when rate discrepancy lines exist; or via **`POST …/debit-note`**; reference pattern `DN-GRN-{id}-{YYYYMMDD}` |
| `ISSUED` | Accounts team assigns a real DN number in the Zap UI |
| `EXPORTED` | Tally CSV downloaded via debit-note/export |
| `CLOSED` | Vendor CN copy uploaded via cn-copy endpoint |

### Accounts Team — Zap DN (if applicable)

This is the **rate-discrepancy** Zap debit note only—not the shortage/damage GRN-linked records in §3.

1. **When it applies:** A row exists in `inbound_zap_debit_notes` when there is a positive price delta (`received_price > audit_price`) on accepted quantity—typically after **`POST …/close`** (auto) or **`POST …/debit-note`** (explicit). If **no** Zap note exists, Accounts has no Zap DN number to assign; the invoice Excel export still works but omits DN summary lines and the **Debit Note** worksheet.

2. **Assign DN number:** Accounts sets the real vendor/register **DN number** with **`PATCH /api/inbound/grns/[grnId]/debit-note`** and JSON body `{ "dn_number": "<assigned number>" }`, which calls [`assignDnNumber`](../../src/server/services/grnDebitNoteService.ts) and moves **`DRAFT` / `EXPORTED`** → **`ISSUED`**.

3. **Invoice and DN in Excel:** **`GET /api/inbound/grns/[grnId]/invoice-export`** ([`buildInvoiceExcel`](../../src/server/services/grnDebitNoteService.ts)) builds one workbook: **Summary** (includes DN reference, number, total, status when a note exists), **GRN Items**, and **Debit Note** line sheet when applicable. On the web GRN **Accounts** tab, **Download Invoice Excel** appears after physical invoice **`COLLECTED`** (see §1); the API route itself does not enforce `COLLECTED`.

4. **Close the demand (CN copy):** After the DN is raised and numbered, **`POST /api/inbound/grns/[grnId]/debit-note/cn-copy`** (multipart `file`) stores the vendor **CN copy** and sets the note to **`CLOSED`** ([`uploadCnCopy`](../../src/server/services/grnDebitNoteService.ts)); a DN number must already be assigned.

5. **Alternate close (no CN file):** **`PATCH …/debit-note`** with `{ "close": true }` calls [`closeDnDemand`](../../src/server/services/grnDebitNoteService.ts) and sets **`CLOSED`** without an uploaded CN—use only when your process allows closing the demand without storing a CN PDF in Zap.

---

## 3 — GRN-linked credit / debit note (shortage · damage · vendor adjustment)

Zap persists these on **`inbound_grn_debit_credit_notes`**; numbering, uploads, pending queues, and decisions are enforced through **this product** (source of truth in Zap Postgres).

```mermaid
flowchart TD
    ZGRN_DETAIL["GRN_detail_and_lines_in_Zap"] --> NOTE_EXISTS{DCN on
this GRN?}

    NOTE_EXISTS -->|Yes| NOTE_TYPE{Type}

    NOTE_TYPE -->|Debit Note| DN_GRN["Debit Note
DEBIT_NOTE — shortage / damage"]
    NOTE_TYPE -->|Credit Note| CN_GRN["Credit Note
CREDIT_NOTE — vendor overpayment"]

    DN_GRN --> NUM_ASSIGN{Number
Assigned?}
    CN_GRN --> NUM_ASSIGN

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

## Key distinction

| | Zap rate-diff debit note (§2) | GRN-linked debit/credit records (§3) |
|---|---|---|
| **Source** | Created in Zap from rate audit deltas | Persisted on the GRN in Zap |
| **Trigger** | **`received_price` > `audit_price`** after audit-aware close / generate | Receipt issues, vendor shortage/damage/overpayment workflows |
| **Table** | `inbound_zap_debit_notes` | `inbound_grn_debit_credit_notes` |
| **Lifecycle** | DRAFT → ISSUED → EXPORTED → CLOSED | Assignment / upload / reversal per fields on §3 diagram |
