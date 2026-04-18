# Outbound consignments + companies + delivery locations — sync plan

This document describes **how Zap ingests** eCraft / eAutomate outbound data used on **Outbound → Consignments**, how it maps to the UI, **what already exists** in the repo, **optional enhancements**, and **commands to run**.

**Related**

- Implementation: [`scripts/sync-eautomate-outbound-consignments.ts`](../scripts/sync-eautomate-outbound-consignments.ts), [`scripts/sync-eautomate-companies.mjs`](../scripts/sync-eautomate-companies.mjs)
- Service layer: [`src/server/services/outboundConsignmentsService.ts`](../src/server/services/outboundConsignmentsService.ts)
- UI: [`src/app/(app)/(logistics)/outbound/consignments/`](../src/app/(app)/(logistics)/outbound/consignments/)
- Schema: [database-schema.md](./database-schema.md) (`outbound_consignments`, `outbound_consignment_delivery_locations`, `companies`)
- Auth / base URL: [eautomate-public-api-reference.md](./eautomate-public-api-reference.md)

---

## 1. APIs (source of truth)

### 1.1 Companies

| Method | Path | Purpose |
|--------|------|---------|
| **GET** | `{base}/public/api/companies` | Channel buyer companies (`company_id`, `company_name`, `attributes`, `is_active`, …) |

**Response shape (example):**

```json
{
  "company_id": 30040,
  "company_name": "Blinkit",
  "attributes": { "description": "..." },
  "is_active": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

Envelope may wrap rows in `data`, `content`, etc.; the ingest script normalizes arrays.

---

### 1.2 Delivery locations

| Method | Path | Purpose |
|--------|------|---------|
| **GET** | `{base}/public/api/incoming_purchase_orders/delivery_locations` | Warehouse / delivery location names used on consignments |

Stored in Zap as **`outbound_consignment_delivery_locations`** (name, sort_order, raw JSON, `synced_at`). Powers filters and aligns with the **Location** column on the Consignments screen.

---

### 1.3 Consignments (paginated)

| Method | Path | Purpose |
|--------|------|---------|
| **POST** | `{base}/public/api/incoming_purchase_orders/consignments/all/paginated?search_keyword=&page={n}&count={pageSize}` | Paginated consignment rows |

**Query**

- `search_keyword` — optional filter string (often `""` for full list).
- `page` — 1-based page index.
- `count` — page size (e.g. **100**, matches “Showing 100 of 3537” style UIs).

**JSON body (filter payload)**

```json
{
  "poNumber": "",
  "invoiceNumber": "",
  "companyIds": [],
  "deliveryLocations": [],
  "rtdDates": []
}
```

Empty strings / empty arrays = **no filter** (fetch all pages). The live eCraft UI uses the same dimensions when users narrow by company, PO, invoice, location, or RTD date — those map 1:1 to this payload for **filtered sync** (see §5).

**Pagination rule:** repeat `page = 1, 2, 3, …` until:

- the API returns **fewer than `count`** rows, or  
- **zero** rows,

then stop (“get all in loop”).

---

## 2. Where data is stored (Zap DB)

| Source | Postgres target | Notes |
|--------|-----------------|--------|
| GET companies | `companies` | Upsert by `id` (= `company_id`). Used for FK integrity on consignment `company_id` where present. |
| GET delivery_locations | `outbound_consignment_delivery_locations` | Upsert locations for dropdowns / consistency. |
| POST consignments paginated | `outbound_consignments` | Upsert by eAutomate **consignment `id`**; full payload also in `raw` JSONB. |

Details: [database-schema.md](./database-schema.md) § Outbound consignments.

---

## 3. UI ↔ API ↔ DB mapping (Consignments table)

Based on the **Outbound → Consignments** grid (company logo, statuses, counts, RTD, etc.):

| UI column (concept) | Typical API / derived field | Filter field in POST body |
|----------------------|-----------------------------|---------------------------|
| Consignment ID | `id` | — |
| Company Name / logo | `company_id`, `company_name` (+ join to `companies` if needed) | `companyIds` |
| Location | location / delivery location string | `deliveryLocations` |
| Sold Via | `sold_via` | — |
| PO Number | `po_number` | `poNumber` |
| PO Type | `po_type` | — |
| Consignment Status | `consignment_status` | — |
| Invoice Number Status | invoice status fields | — |
| Invoice Number | invoice number | `invoiceNumber` |
| Invoice Upload Status | upload status | — |
| Boxes / SKU / Total qty | counts on row | — |
| Transporter / Vehicle | transporter, vehicle, docket | — |
| Created / RTD timestamps | created_at, marked_rtd_at, … | `rtdDates` (for date-range filter when supported upstream) |

Exact JSON keys are normalized in [`outboundConsignmentsService.ts`](../src/server/services/outboundConsignmentsService.ts) (`pickStr`, nested `company`, etc.).

---

## 4. Current implementation status (already in repo)

| Step | Status | Script / entry |
|------|--------|----------------|
| Sync **companies** | Implemented | `npm run sync:outbound-companies` → [`sync-eautomate-companies.mjs`](../scripts/sync-eautomate-companies.mjs) |
| Sync **delivery_locations** + **consignments** (loop pages, empty filter body) | Implemented | `npm run sync:outbound-consignments` → [`sync-eautomate-outbound-consignments.ts`](../scripts/sync-eautomate-outbound-consignments.ts) |
| Consignments **API** | POST with `DEFAULT_BODY` (all filters empty) | Same file — loops until short page or empty |
| Master orchestration (includes outbound block) | Implemented | `npm run sync:eautomate:all` → [`sync-all-eautomate.sh`](../scripts/sync-all-eautomate.sh) |

**CLI flags already supported** (consignments script):

- `--search-keyword ""` — keyword for query param  
- `--count 100` — page size (max 500 in parser)  
- `--max-pages 10000` — safety cap  
- `--skip-locations` — only run consignment POST loop (skip GET delivery_locations)

---

## 5. Expected changes (optional backlog)

These are **not required** for “sync everything”; add only if product asks for parity with eCraft filters.

| Enhancement | Description |
|-------------|-------------|
| **Filtered sync CLI** | Extend `sync-eautomate-outbound-consignments.ts` to accept `--company-ids 30040,30055`, `--po-number`, `--invoice-number`, `--delivery-locations`, `--rtd-from` / `--rtd-to` and build the POST body (still paginate). |
| **Scheduled job** | Cron / GitHub Action running `sync:outbound-companies` + `sync:outbound-consignments` with `EAUTOMATE_*` secrets. |
| **Observability** | Log total pages, duration, rows upserted; optional Slack/webhook on failure. |
| **Rate limiting** | Sleep between pages if eAutomate throttles (`EAUTOMATE_PAGE_DELAY_MS`). |

---

## 6. How to run (operators)

**Prerequisites**

- `web/` dependencies installed (`npm install`).  
- Migrations applied (`npm run migrate`) so `companies`, `outbound_consignments`, `outbound_consignment_delivery_locations` exist.  
- `web/.env.local` (or `.env`): `DATABASE_URL`, and **eAutomate auth** (`EAUTOMATE_COOKIE` or `EAUTOMATE_BEARER_TOKEN`, or login env vars per [eautomate-public-api-reference.md](./eautomate-public-api-reference.md)).

### 6.1 Full outbound-related sync (recommended for fresh data)

From **`web/`**:

```bash
npm run sync:outbound-companies
npm run sync:outbound-consignments
```

Or use the master script (outbound phase includes companies + partial POs + consignments):

```bash
npm run sync:eautomate:all
```

For **only** companies + consignments + delivery locations (skip huge vendor/GRN phases):

```bash
bash scripts/sync-all-eautomate.sh --skip-vendor-details --skip-vendor-pos --skip-grns --skip-grns-pending --skip-secondary --skip-po-details --skip-grn-details
```

(Adjust skips if you still need vendor PO list.)

### 6.2 Consignments only (large tenant: e.g. 3537 rows @ 100/page ≈ 36 pages)

```bash
cd web
npm run sync:outbound-consignments -- --count 100 --max-pages 100
```

Increase `max-pages` if total consignments grow beyond `count * max-pages`.

Optional: skip refreshing delivery locations if you only need consignment rows:

```bash
npm run sync:outbound-consignments -- --skip-locations --count 100
```

### 6.3 Dry run (see what full sync would invoke)

```bash
npm run sync:eautomate:all:dry
```

---

## 7. Verification after sync

1. **SQL** (approximate counts):

   ```sql
   SELECT COUNT(*) FROM outbound_consignments;
   SELECT COUNT(*) FROM outbound_consignment_delivery_locations;
   SELECT COUNT(*) FROM companies;
   ```

2. **UI:** open **Outbound → Consignments**; total in header should move toward eCraft totals after sync completes (same filters: empty search = all).

3. **If empty:** check auth (401), `EAUTOMATE_BASE_URL`, and that POST body is accepted (network tab in browser vs script).

---

## 8. Document control

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-04-18 | Initial plan: APIs, storage, UI mapping, existing scripts, runbook |

**Owner:** Engineering + Ops (validate counts vs eCraft periodically).
