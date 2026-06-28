# Process Flows — Technical

End-to-end runtime flows as implemented today. For each flow you get: a sequence diagram (what happens at request time), a state diagram or flowchart where helpful (lifecycles and branches), and a small reference table (page → route → tables → permission).

Diagrams use [Mermaid](https://mermaid.live). VS Code and GitHub render them inline.

---

## How to read this doc

> **The boundary rule:** the zap UI reads **only** from the zap Postgres database. eAutomate is never called inline from a UI request. Sync from eAutomate runs out-of-band via `npm run sync:*` scripts. If a UI screen looks stale, the answer is to run the right sync script — not to add a refresh button.
>
> The full set of architectural rules (this is rule #1 of 9) lives in [**../../../docs/zap-doctrine.md**](../../../docs/zap-doctrine.md).

**Legend** (used in every diagram below):

```mermaid
flowchart LR
  U([User])
  UI[Next.js page / mobile app]
  API[(API route)]
  PG[("Postgres")]
  ST{{"Zap Storage"}}
  EA["eAutomate (upstream)"]:::ext
  classDef ext fill:#eee,stroke:#999,stroke-dasharray: 4 4,color:#555
```

- **Solid arrows** = synchronous request/response.
- **Dashed boxes** (eAutomate) = touched only by sync scripts, not by consignment create from the PO detail UI.

---

## Stale-data decision tree

If something looks wrong on a screen, route the issue here first:

```mermaid
flowchart TD
  A[Symptom on a page] --> B{What's wrong?}
  B -->|Wrong vendor / SKU name / qty| C[Run the matching sync script]
  B -->|404 on a PO/GRN you expected| D{Was it created in zap?}
  B -->|Missing file / 'not yet mirrored'| E[File mirror sync not yet built]
  B -->|Permission denied| F[Check role × permission grid below]

  C --> C1["sync:vendors:all<br/>sync:vendor-pos:all<br/>sync:po:details:from-db<br/>sync:grns:all<br/>sync:grn:details:if-needed<br/>sync:outbound-pos:all<br/>sync:outbound-po-detail"]

  D -->|Yes, locally created| D1[Expected — header renders from zap; line/GRN data is empty until eAutomate also has the PO]
  D -->|No, came from eAutomate| D2[Run sync:vendor-pos:all then sync:po:details:from-db]

  E --> E1[Track in follow-ups list — UI cannot fall back to eAutomate]

  F --> F1[See Section 1 — RBAC]
```

---

## 1. Auth & RBAC

### Login (web) — JWT path

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Next.js UI
  participant API as POST /api/auth/login
  participant PG as Postgres

  U->>UI: email + password
  UI->>API: { email, password }
  API->>PG: SELECT users WHERE email=$1
  PG-->>API: user row + password_hash
  API->>API: bcrypt.compare(password, hash)
  API->>PG: load roles, permissions for user_id
  PG-->>API: RBAC graph
  API-->>UI: { token: JWT, user, permissions }
  UI->>UI: localStorage.setItem('token', JWT)
  Note over UI,API: Subsequent requests: Authorization: Bearer <JWT>
```

### Integration path — API key

```mermaid
sequenceDiagram
  participant C as Integration
  participant API as Any /api/* route
  participant PG as Postgres

  C->>API: GET ... with Authorization: Bearer <api_key><br/>(or X-API-Key)
  API->>PG: SELECT users WHERE api_key_hash matches (bcrypt)
  PG-->>API: user row
  API->>PG: load same RBAC graph
  PG-->>API: graph
  Note over API: Same request lifecycle as JWT from here
```

### Request lifecycle — `requireAuth` then `assertPermission`

```mermaid
flowchart TD
  R[Incoming request] --> A[requireAuth]
  A -->|No / bad token| R401[401 Unauthorized]
  A -->|OK, user loaded| P[assertPermission resource×action]
  P -->|Missing permission| R403[403 Forbidden]
  P -->|OK| H[handler runs]
  H --> R200[200 + JSON]
```

### Permissions used by inbound and outbound

| Resource | Action | Used by (examples) |
|---|---|---|
| `purchase_orders` | `read` | All PO/GRN read routes (list, detail, files, items, logs, consignments GET, lot-listings, form-options) |
| `purchase_orders` | `create` | `POST /consignments`, `POST /eautomate-actions`, GRN draft/submit, PO modify/cancel |

Other resources (catalogue, vendors, listings, bulk_ops, etc.) follow the same `requireAuth → assertPermission` shape.

---

## 2. Files (Zap Storage)

### Upload

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Page / drop zone
  participant API as POST upload route
  participant ST as Zap Storage bucket
  participant PG as Postgres

  U->>UI: drag/drop file
  UI->>API: multipart POST (file, parent ids)
  API->>ST: putObject → returns object key
  API->>PG: INSERT row with zap_storage_path = key
  API-->>UI: { file_id, file_name }
```

### Download — Zap Storage only (no eAutomate fallback)

```mermaid
sequenceDiagram
  participant U as User
  participant API as GET file route
  participant PG as Postgres
  participant ST as Zap Storage

  U->>API: GET /api/.../files/{fileId}
  API->>PG: SELECT file_name, zap_storage_path WHERE id=$1
  alt zap_storage_path is set
    API->>ST: downloadBufferFromBucket(path)
    ST-->>API: bytes
    API-->>U: 200 + Content-Disposition
  else no path
    API-->>U: 404 "not in Zap Storage; mirror via sync"
  end
```

> **Behaviour change:** before the recent refactor, both file routes fell back to fetching the file from eAutomate when not in Zap Storage. They no longer do — UI never reaches eAutomate. A file-mirror sync job is the planned follow-up; until then, "missing in storage" surfaces as a 404 to the UI.

| Route | Bucket | Tables | Notes |
|---|---|---|---|
| `GET /api/inbound/grns/{grnId}/files/{fileId}?kind=invoice` | inbound | `inbound_grn_invoice_files` | |
| `GET /api/inbound/grns/{grnId}/files/{fileId}?kind=debit_note&noteId=N` | inbound | `inbound_grn_debit_credit_note_files` | |
| `GET /api/outbound/purchase-orders/{id}/eautomate-files/{fileId}` | outbound | `outbound_po_eautomate_files` | |

---

## 3. Inbound — PO → GRN → Detail

### PO lifecycle

```mermaid
stateDiagram-v2
  [*] --> Pending: zap-created (INSERT vendor_purchase_orders) OR sync from eAutomate
  Pending --> Published: date_published set
  Published --> Cancelled: zap_status set to CANCELLED via /modify
  Pending --> Cancelled: zap_status set to CANCELLED
  Published --> Closed: all GRNs closed
  Cancelled --> [*]
  Closed --> [*]
```

### GRN lifecycle

```mermaid
stateDiagram-v2
  [*] --> Draft: POST /api/inbound/grns (negative grn_id)
  Draft --> Submitted: line entry + submit
  Submitted --> Closed: POST /api/inbound/grns/{id}/close
  Submitted --> Draft: re-open for edit
  Submitted --> WithDCN: shortage → debit/credit note
  WithDCN --> Closed: DCN approved
  Closed --> [*]
```

### PO creation in zap (locally-allocated id)

```mermaid
sequenceDiagram
  participant U as User
  participant API as POST /api/inbound/vendors/{vid}/purchase-orders
  participant PG as Postgres
  Note over API,PG: zap DB only — eAutomate not contacted

  U->>API: { vendor_id, expected_date, lines[] }
  API->>PG: SELECT vendors WHERE id=$1 (validate)
  API->>PG: SELECT vendor_sku WHERE vendor_id+sku_id (validate each line)
  API->>PG: SELECT MAX(po_id) FROM vendor_purchase_orders
  PG-->>API: max → po_id = max + 1
  API->>PG: INSERT vendor_purchase_orders (po_id, vendor_id, vendor_name, …)
  API->>PG: INSERT vendor_purchase_order_lines (po_id, sku_id, quantity)
  API-->>U: { po_id }
  Note over U: PO is local-only until npm run sync:vendor-pos:all<br/>(or sync:eautomate:all) carries it back to eAutomate
```

### PO detail page open

```mermaid
sequenceDiagram
  participant U as User
  participant API as GET /api/inbound/vendors/{vid}/purchase-orders/{poId}/details
  participant PG as Postgres
  Note over U,PG: No eAutomate call. No ?refresh=1.

  U->>API: GET (auth + permission)
  API->>PG: JOIN vendor_purchase_orders + vendors → header
  alt snapshot exists
    API->>PG: SELECT inbound_po_detail_snapshot, lines, grns
  else no snapshot (locally-created PO)
    API->>API: synthesise empty snapshot/lines/grns
  end
  API-->>U: { header, snapshot, lines, grns }
```

The `header` object is canonical (vendor name comes from the `vendors` table via JOIN). The `snapshot` carries eAutomate-sourced extras (SKU names, vendor listings, GRN line raw JSON) and is empty for locally-created POs.

### GRN detail page

Reads only from these tables:

```mermaid
flowchart LR
  GRN[(inbound_grns<br/>header)]
  SNAP[(inbound_grn_detail_snapshot<br/>vendor_raw, po_raw)]
  ADD[(inbound_grn_added_items)]
  ITM[(inbound_grn_items)]
  INV[(inbound_grn_invoice_files)]
  DCN[(inbound_grn_debit_credit_notes)]
  DCNF[(inbound_grn_debit_credit_note_files)]
  LOG[(inbound_grn_logs)]
  GRN --> SNAP
  GRN --> ADD
  GRN --> ITM
  GRN --> INV
  GRN --> DCN
  DCN --> DCNF
  GRN --> LOG
```

### Pending audits — close → next queue

A separate sub-state of the GRN's life. `grn_status='CLOSED'` (from the lifecycle above) does **not** mean the GRN is done — it just means the warehouse finished receiving. An auditor still has to verify line-by-line quantities. While that's pending, the GRN sits in `inbound_grn_pending_audit` (a one-column queue table keyed by `grn_id`). Per [doctrine #10](../../../docs/zap-doctrine.md), the queue is owned by zap once the record exists; sync only repopulates rows where `source = 'eautomate'`.

> **Manual sync.** The queue is repopulated by `npm run sync:grns:pending-audit`. Nothing inside a request handler triggers it (doctrine #2). If a row looks stuck, check the sync timestamp before assuming a bug.

#### Happy path

Only users with the **`admin` role** may mark a GRN as audited. The web UI shows a **Confirm Audit** dialog before calling the API; non-admins see a disabled **Mark Audited** button.

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Admin_auditor
  participant UI as /inbound/pending-audits
  participant API as /api/inbound/...
  participant DB as zap Postgres
  participant EA as eAutomate

  Note over EA,DB: scripts/sync-eautomate-grns-pending-audit.mjs (manual)
  EA->>DB: UPSERT inbound_grns
  EA->>DB: TRUNCATE + INSERT inbound_grn_pending_audit
  Admin->>UI: open queue
  UI->>API: GET /api/inbound/pending-audits/grns
  API->>DB: SELECT … inbound_grns g INNER JOIN inbound_grn_pending_audit q
  DB-->>API: rows where grn_audit_status NOT IN ('CLOSED','AUDITED','DONE','COMPLETED')
  API-->>UI: list (includes grn_audit_price_total for admin column)
  Admin->>UI: open one GRN → /inbound/grns/{grnId}
  UI->>API: GET /api/inbound/grns/{grnId}/details
  API->>DB: read header + snapshot + items + files
  loop for each line correction while audit not closed
    Admin->>UI: enter accepted/rejected/shortage/audit_price
    UI->>API: PATCH /api/inbound/grns/{grnId}/items/{lineIndex}
    API->>DB: jsonb_set inbound_grn_items.raw; INSERT inbound_grn_logs (LINE); UPDATE zap_receipt_exception when needed
  end
  Admin->>UI: Mark audited
  UI->>Admin: Confirm Audit dialog (GRN id, vendor, shortage, irreversibility warning)
  Admin->>UI: Confirm
  UI->>API: PATCH /api/inbound/grns/{grnId} { grn_audit_status: "CLOSED" }
  API->>API: require admin role (else 403 + AUDIT_DENIED log)
  API->>DB: UPDATE inbound_grns SET grn_audit_status='CLOSED', grn_audit_by=user.email
  API->>DB: DELETE FROM inbound_grn_pending_audit WHERE grn_id=?
  API->>DB: INSERT INTO inbound_grn_pending_invoice_collection
  API->>DB: INSERT inbound_grn_logs (STATUS, AUDIT)
  API->>DB: tryAutoGenerateDebitNoteAfterGrnClose when received_price > audit_price
  API-->>UI: 200
  UI-->>Admin: row gone — now in Pending Invoice Collection
  Note over Admin,DB: After audit closed, line PATCH returns 409 + AUDIT_LOCKED log
```

#### `grn_audit_status` state diagram

```mermaid
stateDiagram-v2
  [*] --> Pending: row inserted into inbound_grn_pending_audit
  Pending --> Closed: PATCH /api/inbound/grns/{id} grn_audit_status='CLOSED'
  note right of Closed
    Field-update trigger runs inboundGrnWorkflow
    .grnQueueTransitionsForFieldUpdate →
    dequeue ['audit'], enqueue ['invoice_collection']
  end note
  Closed --> [*]
```

Statuses that count as terminal here: `CLOSED`, `AUDITED`, `DONE`, `COMPLETED` (`grnQueueTransitionsForFieldUpdate` in [src/lib/inboundGrnWorkflow.ts](../../src/lib/inboundGrnWorkflow.ts) normalises to upper-case).

#### Where this lives

| Layer | Path | What it does |
|---|---|---|
| Queue table | `migrations/026_inbound_grn_pending_audit_queue.sql` | `inbound_grn_pending_audit (grn_id PK)` |
| Exception flag | `migrations/057_grn_receipt_exception.sql` | `inbound_grns.zap_receipt_exception BOOLEAN` |
| List route | [`src/app/api/inbound/pending-audits/grns/route.ts`](../../src/app/api/inbound/pending-audits/grns/route.ts) | GET pending list — `purchase_orders.read`; includes `grn_audit_price_total` |
| Status PATCH | [`src/app/api/inbound/grns/[grnId]/route.ts`](../../src/app/api/inbound/grns/[grnId]/route.ts) | PATCH terminal `grn_audit_status` — **`admin` role required** (`purchase_orders.write` alone is insufficient); logs `AUDIT_DENIED` on 403, `AUDIT` on success; triggers rate-diff DN |
| Line PATCH | [`src/app/api/inbound/grns/[grnId]/items/[lineIndex]/route.ts`](../../src/app/api/inbound/grns/[grnId]/items/[lineIndex]/route.ts) | Quantity/price entry; **409** when audit is terminal (`AUDIT_LOCKED` log) |
| Service | [`src/server/services/inboundGrnsService.ts`](../../src/server/services/inboundGrnsService.ts) | `listPendingAuditGrnsPaginated`, `updateGrnStatus`, `updateInboundGrnItemRaw`, `applyGrnQueueDelta` |
| Workflow rules | [`src/lib/inboundGrnWorkflow.ts`](../../src/lib/inboundGrnWorkflow.ts) | `grnQueueTransitionsForFieldUpdate` (pure) |
| Sync | `scripts/sync-eautomate-grns-pending-audit.mjs` | Repopulates the queue from upstream |
| Queue UI | `src/app/(app)/(logistics)/inbound/pending-audits/page.tsx` | List + admin-only Mark Audited + Confirm Audit dialog + admin Audited Price Total column |

#### Known gaps (doctrine-vs-implementation)

> **Not transactional.** `updateGrnStatus` issues three sequential queries (UPDATE header → queue DELETE+INSERT → log) instead of one transaction. Doctrine #10 requires them to share a transaction; a mid-failure can leave header + queue out of sync. Tracked as a TODO.
>
> **Sync truncates without `source` scoping.** `sync-eautomate-grns-pending-audit.mjs` does an unconditional TRUNCATE. Doctrine #10 requires sync writes to scope `source = 'eautomate'`. A zap-source GRN locally enqueued for audit would be wiped on the next sync — and we currently *do* have at least one zap-source row in the queue (sequence-id `10000000003`+), so this is fireable, not theoretical.
>
> **No undo / re-open from UI.** Once `grn_audit_status='CLOSED'`, the UI offers no way to re-add it to the queue. Recovery requires a manual PATCH against the API or direct DB intervention.
>
> **Lines locked after audit.** Once audit is terminal, `updateInboundGrnItemRaw` rejects line edits (HTTP **409**) and the GRN INPUT sheet is read-only. Attempts are logged as `AUDIT_LOCKED` in `inbound_grn_logs`.
>
> **Header survives sync.** The sync TRUNCATEs the queue table but only UPSERTs `inbound_grns` columns. A locally-CLOSED GRN keeps `grn_audit_status='CLOSED'` after sync and is correctly excluded from the list query.

### Inbound page → route → tables

| Page | Route | Tables read | Tables written | Permission |
|---|---|---|---|---|
| PO list | `GET /api/inbound/purchase-orders` | `vendor_purchase_orders`, `vendors` | — | `purchase_orders.read` |
| Vendor-scoped PO list | `GET /api/inbound/vendor-purchase-orders?vendor_id=N` | same | — | `purchase_orders.read` |
| PO detail | `GET /api/inbound/vendors/{vid}/purchase-orders/{poId}/details` | + snapshot/lines/grns | — | `purchase_orders.read` |
| Create PO | `POST /api/inbound/vendors/{vid}/purchase-orders` | `vendors`, `vendor_sku` | `vendor_purchase_orders` (+ lines) | `purchase_orders.create` |
| GRN list | `GET /api/inbound/grns` | `inbound_grns` | — | `purchase_orders.read` |
| GRN detail | `GET /api/inbound/grns/{grnId}/details` | `inbound_grns`, snapshot, lines, files, DCN, logs | — | `purchase_orders.read` |
| GRN files | `GET /api/inbound/grns/{grnId}/files/{fileId}?kind=…` | invoice/DCN file table | — | `purchase_orders.read` |
| Pending audit / invoice / DCN queues | `GET /api/inbound/pending-*` | per-queue tables | — | `purchase_orders.read` |
| Lot listings (SKU-wise PO view) | `GET /api/inbound/lot-listings` | *no zap mirror yet* | — | `purchase_orders.read` |

---

## 4. Outbound — PO → Consignment → Dispatch

### Outbound PO lifecycle

```mermaid
stateDiagram-v2
  [*] --> New: synced from eAutomate
  New --> Acknowledged: POST eautomate-actions action=acknowledge
  Acknowledged --> WIP: is_wip=YES via save_field
  WIP --> Dispatched: consignment created + dispatched
  Dispatched --> Closed: all qty fulfilled
  New --> Cancelled: POST action=cancel
  Acknowledged --> Cancelled
  WIP --> Cancelled
  Cancelled --> [*]
  Closed --> [*]
```

### Detail page load

```mermaid
sequenceDiagram
  participant U as User
  participant API as GET /api/outbound/purchase-orders/{id}/detail
  participant PG as Postgres
  Note over U,PG: zap DB only — no inline sync to eAutomate

  U->>API: GET
  API->>PG: SELECT outbound_purchase_orders WHERE id=$1<br/>(includes listings_snapshot JSONB)
  par parallel
    API->>PG: SELECT outbound_po_eautomate_files WHERE outbound_po_id=$1
    API->>PG: SELECT zap attachments
  end
  API-->>U: { po, listings, eautomateFiles, zapAttachments, ... }
```

### Create consignment — Zap-native

```mermaid
sequenceDiagram
  participant U as User
  participant API as POST /api/outbound/purchase-orders/{id}/consignments
  participant PG as Postgres

  U->>API: create consignment (PO must be WIP: Y or YES)
  API->>PG: SELECT outbound_purchase_orders WHERE id=$1
  API->>PG: INSERT outbound_consignments (Zap id sequence)
  API->>PG: INSERT outbound_po_logs + refresh analytics
  API-->>U: { ok: true, consignment: { id } }
```

### Action menu — `POST /eautomate-actions`

```mermaid
flowchart TD
  In[POST body action] --> Act{action}
  Act -->|acknowledge| A1[UPDATE outbound_purchase_orders → ack flag]
  Act -->|cancel| A2[UPDATE outbound_purchase_orders → CANCELLED]
  Act -->|save_field| A3[UPDATE one editable column]
  Act -->|download_sku_report| A4[Read outbound_consignment_items OR listings_snapshot → CSV]
  Act -->|download_pendency_pdf| A5[listings_snapshot + loadPendencyLookups → PDF: PO SKU, master_sku, bins]
  Act -->|generate_product_labels| A6[Read snapshot + labels_master_data → JSON for label wizard]
  Act -->|generate_phase1_box_labels| A7[Local PDF generator from box range]
```

All actions read/write zap DB only. Three of them produce binary downloads (CSV/PDF) generated server-side.

### Outbound page → route → tables

| Page | Route | Tables read | Tables written | Permission |
|---|---|---|---|---|
| PO list | `GET /api/outbound/purchase-orders` | `outbound_purchase_orders` | — | `purchase_orders.read` |
| PO detail | `GET /api/outbound/purchase-orders/{id}/detail` | + `outbound_po_eautomate_files`, attachments | — | `purchase_orders.read` |
| PO line items | `GET /api/outbound/purchase-orders/{id}/items` | reads `listings_snapshot` JSONB | — | `purchase_orders.read` |
| PO logs | `GET /api/outbound/purchase-orders/{id}/logs` | `outbound_po_logs` | — | `purchase_orders.read` |
| PO consignments list | `GET /api/outbound/purchase-orders/{id}/consignments` | `outbound_consignments` | — | `purchase_orders.read` |
| Create consignment | `POST /api/outbound/purchase-orders/{id}/consignments` | reads PO row | `outbound_consignments` (+ writes to eAutomate) | `purchase_orders.create` |
| Action menu | `POST /api/outbound/purchase-orders/{id}/eautomate-actions` | varies by action | varies (PO row, files generated) | `purchase_orders.create` |
| File download | `GET /api/outbound/purchase-orders/{id}/eautomate-files/{fileId}` | `outbound_po_eautomate_files` | — | `purchase_orders.read` |
| Form options | `GET /api/outbound/form-options` | `outbound_companies`, `outbound_sold_via` | — | `purchase_orders.read` |

---

## 5. Sync boundary (1 page)

The UI never refreshes from eAutomate inline. Sync runs out-of-band via npm scripts. Each script writes to its target tables; the UI then sees the new data on the next read.

```mermaid
flowchart LR
  OPS([Ops / cron]) --> A[npm run sync:eautomate:all]
  A --> S1[sync:vendors:all]
  A --> S2[sync:vendor-pos:all]
  A --> S3[sync:grns:all]
  A --> S4[sync:secondary-listings]
  A --> S5[sync:outbound-pos:all]
  A --> S6[sync:outbound-po-detail]
  A --> S7[sync:outbound-consignments]
  A --> S8[sync:outbound-companies]

  S1 --> T1[(vendors)]
  S2 --> T2[(vendor_purchase_orders)]
  S3 --> T3[(inbound_grns + queue tables)]
  S4 --> T4[(secondary_listings)]
  S5 --> T5[(outbound_purchase_orders + listings_snapshot)]
  S6 --> T6[(outbound_po_logs, listings_snapshot, eautomate_files)]
  S7 --> T7[(outbound_consignments)]
  S8 --> T8[(outbound_companies)]
```

| Script | Populates | When to run |
|---|---|---|
| `sync:vendors:all` | `vendors` | After vendor master changes upstream |
| `sync:vendor-pos:all` | `vendor_purchase_orders` | When a new inbound PO appears in eAutomate |
| `sync:po:details:from-db` | inbound PO snapshot/lines/grns for every PO in zap | After upstream PO line/GRN edits |
| `sync:grns:all` | `inbound_grns` + pending queues | When new GRNs are submitted upstream |
| `sync:grn:details:if-needed` | per-GRN snapshot, lines, DCN | After a GRN's content changes |
| `sync:outbound-pos:all` | `outbound_purchase_orders` headers | When new outbound POs appear |
| `sync:outbound-po-detail` | `listings_snapshot`, logs, eAutomate file metadata | After a save_field edit, or to refresh stale outbound detail |
| `sync:outbound-consignments` | `outbound_consignments` | After dispatch updates upstream |
| `sync:outbound-companies` | `outbound_companies` | When the channel master changes |
| `sync:eautomate:all` | runs the above in order | Daily / on-demand full refresh |

See [../operations/sync-runbook.md](../operations/sync-runbook.md) for credentials, ordering rules, and dry-run mode.

---

## 6. Insights digest (scheduled)

Admin-only Decision Intelligence hub. Ranked insights are computed on demand from existing BI services (`homeSummaryService`, `reorderService`, etc.); a daily digest persists a snapshot for history and email-style review.

```mermaid
sequenceDiagram
  participant CRON as Cron / scheduler
  participant API as POST /api/insights/digest
  participant SVC as decisionIntelligenceService
  participant PG as Postgres

  CRON->>API: Authorization: Bearer INSIGHTS_DIGEST_BEARER_TOKEN
  API->>API: validate bearer (no fallback secret)
  API->>SVC: build ranked Insight[] + summary counts
  SVC->>PG: read insight_config, insight_feedback (suppress dismissed/snoozed)
  API->>PG: INSERT insight_snapshots + insight_snapshot_items
  API-->>CRON: { snapshot_id, counts }
```

| Trigger | Auth | Route | Tables written |
|---|---|---|---|
| Cron (`insightsDigestScheduler`, default `0 6 * * *`) | `INSIGHTS_DIGEST_BEARER_TOKEN` | `POST /api/insights/digest` | `insight_snapshots`, `insight_snapshot_items` |
| Admin manual digest | JWT + `insights:manage` | same | same |

Config: [`src/config/schedulers.ts`](../../src/config/schedulers.ts) — `insightsDigestScheduler`  
Env: `INSIGHTS_DIGEST_BEARER_TOKEN`, optional `INSIGHTS_DIGEST_ENDPOINT`  
Permissions: `insights:read`, `insights:manage` (admin wildcard only by default — see migration `074`)

Interactive worklist dismiss/snooze uses `POST /api/insights/feedback` → `insight_feedback`; suppressed keys are filtered before ranking on subsequent reads.

---

## See also

- Business-facing flows: [../business/workflows/end-to-end-flows.md](../business/workflows/end-to-end-flows.md)
- RBAC seed and permission catalogue: `web/seeds/001_rbac_seed.sql` (and `004_rbac_ecraft_permissions.sql`)
- Schema deep dive: [../database-schema.md](../database-schema.md)
- Module deep dives: [../services/inbound/](../services/inbound/), [../services/outbound/](../services/outbound/)
- Sync runbook: [../operations/sync-runbook.md](../operations/sync-runbook.md)
- Limitations: [limitations.md](limitations.md)
