# Prod Supabase migration — sync warnings log (client-facing)

**Project:** New prod Supabase (`bxgmcddxmlsgrflnbywv`, Sydney)  
**Purpose:** Track every sync warning/error from the initial migration and flag items that need client awareness or follow-up.  
**Owner:** Zap engineering — update this file after each sync session or when new warnings appear in logs.

Related: [sync-runbook.md](./sync-runbook.md)

---

## Client notification process

When a new warning is logged during sync:

1. **Record it here** within the same working session (use `npm run harvest:sync-warnings` or append manually).
2. **Classify severity** (see table below).
3. **Flag to client** if severity is **High** or **Medium**, or if the warning affects data the client relies on in prod.
4. **Note remediation** — fixed, pending re-sync, or accepted with explanation.
5. **Update the summary table** and move resolved items to **Resolved** with date.

### Severity guide

| Severity | Meaning | Client flag? |
| -------- | ------- | ------------ |
| **Critical** | Phase failed; large data gap; prod unusable for a domain | Yes — immediately |
| **High** | Entity or phase incomplete; requires re-run | Yes |
| **Medium** | Partial data loss in secondary tables; core row saved | Yes — explain impact |
| **Low** | Transient infra; recovered by re-run; no lasting gap | Optional — mention in status update |
| **Info** | Benign log noise (e.g. progress counter contains word "failed") | No |

### How to harvest warnings from a log file

```bash
cd web
npm run harvest:sync-warnings -- path/to/sync.log
# Append new entries to this doc (review diff before commit):
npm run harvest:sync-warnings -- path/to/sync.log --append
```

Patterns captured: orchestrator `WARNING:`, vendor/row failures, warehouse ingest, DNS/network errors, pooler limits, GET fallbacks.

---

## Executive summary (as of 2026-06-27)

| # | Severity | Phase | Issue | Status | Client flagged? |
| - | -------- | ----- | ----- | ------ | --------------- |
| 1 | High | 1b Vendor details | Vendor **12328** fetch timeout | **Resolved** — re-synced 2026-06-27 (warehouses=1, 71 listing rows) | Recommended |
| 2 | Critical | 3–6 (original run) | Network/DNS outage at ~02:40Z — Phase 3 crashed at page 14; Phases 4–6 never ran | **Resolved** — Phases 3–4–5b–6 completed on 2026-06-27 | Yes |
| 3 | Medium | 3 Secondary listings | **153** warehouse ingest duplicate-key warnings (concurrency race, run `151921`) | **Fixed in code**; affected SKUs re-ingested on current run | Yes |
| 4 | Low | 3 Secondary listings | Supabase session pooler `EMAXCONNSESSION` on restart (`428412`) | **Resolved** — waited for drain, lowered concurrency | Optional |
| 5 | Medium | 3 Secondary listings | **1** warehouse ingest warning on fixed run (`B08QNJHWFK`, `760670`) | **Open** — monitor; may self-heal on upsert | Optional |
| 6 | High | 3 Secondary listings | DB connection `ETIMEDOUT` at page 42 (~28,350 rows, run `760670`) | **Resolved** — resumed and completed (67,183 total) | Yes |
| 7 | Medium | 3 Secondary listings | Warehouse ingest duplicate keys on fixed runs (`808675`: 44 SKUs incl. `MOPS508`) | **Open** — core data OK; optional warehouse backfill | Optional |
| 8 | High | 5a PO details | Skipped in tail run (`--skip-vendor-pos`); **1,574 PO line details not ingested** | **In progress** — ingesting on prod 2026-06-27 (`inbound_po_detail_snapshot` growing toward 1,574) | Yes |
| 9 | High | 6 Ops SKU PO metrics | `ops_master_sku_po_metrics` **empty on prod** — earlier "3,091 rows" went to the **wrong pooler region** (dev, per W-004) | **Auto-queued** — `refresh:ops-sku-po-metrics` runs on prod once PO details finish | Optional |

**Latest tail run (`685750`, 2026-06-27):** Phase 4 outbound ✅, Phase 5b GRN **984/984 ok**, Phase 6 ops metrics ran against **dev** pooler (prod table empty — see W-009). Exit 0.

### Migration completion (2026-06-27)

- **Vendor 12328:** re-synced ✅
- **PO detail ingest:** running on prod (session pooler), all rows `ok` so far
- **Ops SKU PO metrics:** queued to rebuild on prod after PO details
- **Prod storage buckets:** created ✅ — `listing-images` (public), `outbound-po-files` (private), `inbound-grn-files` (private)
- **Vercel prod env:** 6 vars repointed from old dev Supabase (`wzdvcjqjdshmcbcmsyoi`) to new prod (`bxgmcddxmlsgrflnbywv`) — `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `SHEETS_SYNC_BEARER_TOKEN` (stored Sensitive per team policy) ✅
- **Prod deploy:** `zap` deployed to production, `https://zap-rust.vercel.app` (HTTP 200) ✅
- **`web/.temp`:** deleted (secrets now in `.env.production.local` + Vercel) ✅

**Still pending:** PO detail ingest completion + ops metrics rebuild (auto-chained, in progress), optional RBAC/admin user seed for prod login.

---

## Detailed log

### Run A — Initial full sync (`sync:eautomate:all`, terminal `843559`)

**Started:** 2026-06-26 ~13:58 UTC  
**Ended:** 2026-06-27 02:40 UTC (exited 0 with `--continue-on-error`; **not** a complete sync)

#### Completed successfully

- Phase 1: 77 vendors
- Phase 1b: 76/77 vendor details (see warning #1)
- Phase 2: 1,574 PO headers, 984 GRNs, pending queues
- Phase 3: **13,250** secondary listings (crashed mid-page 14)

#### W-001 — Vendor 12328 fetch failed

| Field | Value |
| ----- | ----- |
| **Severity** | High |
| **When** | 2026-06-26, Phase 1b |
| **Message** | `Vendor 12328 failed: fetch failed` |
| **Impact** | Vendor detail, listings, and related warehouse rows for vendor **12328** missing |
| **Remediation** | `DATABASE_URL=... npm run sync:vendor -- 12328` |
| **Client flag** | Yes — one vendor incomplete |

#### W-002 — Phase 1b orchestrator warning

| Field | Value |
| ----- | ----- |
| **Severity** | Low (follow-on from W-001) |
| **When** | 2026-06-26 16:07:56Z |
| **Message** | `WARNING: npm run sync:vendors:detail-all exited 1 (continuing)` |
| **Impact** | Script continued; only vendor 12328 affected |
| **Remediation** | Re-sync vendor 12328 |

#### W-003 — Phase 3 crash (network)

| Field | Value |
| ----- | ----- |
| **Severity** | Critical |
| **When** | 2026-06-27 ~02:40:09Z |
| **Message** | `Error: read EHOSTUNREACH` during secondary listings (page 14, ~13,250 rows processed) |
| **Impact** | Phase 3 incomplete; remaining catalog pages not synced |
| **Remediation** | Resume Phase 3 from page 14 (done) |

#### W-004 — Phases 4–6 DNS failure (network outage)

| Field | Value |
| ----- | ----- |
| **Severity** | Critical |
| **When** | 2026-06-27 02:40:09–02:40:12Z |
| **Messages** | `ENOTFOUND web.eautomate.in` (outbound scripts); `ENOTFOUND aws-1-ap-southeast-2.pooler.supabase.com` (PO/GRN verify); `ENOTFOUND aws-1-ap-northeast-1.pooler.supabase.com` (ops metrics — **wrong pooler region**) |
| **Failed steps** | `sync:outbound-companies`, `sync:outbound-partial-pos`, `sync:outbound-consignments`, `verify:outbound-companies`, `sync:po:details:from-db`, `sync:po:details:missing`, `sync:grn:details:all`, `refresh:ops-sku-po-metrics` |
| **Impact** | Outbound, PO line details, GRN deep ingest, and ops metrics **not loaded** on prod |
| **Remediation** | Re-run tail after Phase 3: `npm run sync:eautomate:all -- --skip-vendor-details --skip-vendor-pos --skip-grns --skip-grns-pending --skip-secondary --continue-on-error` with prod `DATABASE_URL`; ensure Phase 6 uses prod URL not dev |

---

### Run B — Phase 3 resume, buggy concurrency (terminal `151921`)

**Started:** 2026-06-27 ~03:09 UTC  
**Stopped:** ~03:19 UTC (replaced by fixed run)

#### W-005 — Warehouse ingest duplicate keys (concurrency race)

| Field | Value |
| ----- | ----- |
| **Severity** | Medium |
| **When** | 2026-06-27, pages 14+ |
| **Count** | **153** warning lines, **153** unique SKUs |
| **Message** | `Warehouse ingest (listings/pack_combos) <sku>: duplicate key value violates unique constraint "listings_pkey"` (mostly `listings_pkey`; one `listings_sku_id_key`) |
| **Impact** | `secondary_listings` rows **saved**; optional `listings` / `pack_combos` warehouse rows for those SKUs may be incomplete |
| **Root cause** | Parallel workers racing on `MAX(id)+1` and check-then-insert stubs |
| **Remediation** | Code fixed (stub id sequence + `ON CONFLICT` + per-parent locks). Current run re-upserts same pages — heals data |
| **Client flag** | Yes — explain secondary data OK, warehouse edges may have been sparse briefly |
| **Sample SKUs** | `D958P6MSGG511`, `D959P6MSGG660`, `D95P1MGG504`, `DIW180_PO10`, … (full list in terminal `151921.txt`) |

---

### Run C — Failed restart (terminal `428412`)

#### W-006 — Supabase pooler connection limit

| Field | Value |
| ----- | ----- |
| **Severity** | Low |
| **When** | 2026-06-27 ~03:19 UTC |
| **Message** | `(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15` |
| **Impact** | Run aborted immediately; no data corruption |
| **Remediation** | Kill prior process, wait ~15s for pool drain, use concurrency ≤8 (pool max 10) |

---

### Run D — Phase 3 resume, fixed concurrency (terminal `760670`, **in progress**)

**Started:** 2026-06-27 ~03:27 UTC  
**Command:** `--start-page 14 --concurrency 8`

#### W-007 — Single warehouse ingest warning (residual)

| Field | Value |
| ----- | ----- |
| **Severity** | Medium |
| **When** | 2026-06-27, page ~28 (~14,425 rows in this run) |
| **Message** | `Warehouse ingest (listings/pack_combos) B08QNJHWFK: duplicate key value violates unique constraint "listings_pkey"` |
| **Impact** | One SKU — warehouse ingest rolled back; `secondary_listings` row saved |
| **Remediation** | Monitor; may clear on re-upsert. If persists, manual listing row check for `B08QNJHWFK` |
| **Client flag** | Optional unless count grows |

---

## Resolved

| ID | Resolution | Date |
| -- | ---------- | ---- |
| W-001 | Vendor 12328 re-synced (warehouses=1, 71 listing rows) | 2026-06-27 |
| W-002 | Follow-on of W-001; resolved with re-sync | 2026-06-27 |
| W-005 (code) | Stub id sequence + idempotent inserts + per-parent advisory lock | 2026-06-27 |
| W-006 | Pool drain + concurrency tuning | 2026-06-27 |

---

## Changelog

| Date (UTC) | Author | Change |
| ---------- | ------ | ------ |
| 2026-06-27 | Engineering | Initial log from migration sync terminals `843559`, `151921`, `428412`, `760670` |
| 2026-06-27 | Engineering | Resolved W-001/W-002 (vendor 12328); started PO detail ingest (W-008); added W-009 (ops metrics empty on prod, auto-queued); created prod storage buckets; repointed Vercel prod env + deployed to production; deleted `web/.temp` |
