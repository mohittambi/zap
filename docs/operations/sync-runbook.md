# Operations — eAutomate sync runbook

**Canonical location:** `web/docs/operations/sync-runbook.md`. Older links may point to `web/docs/sync-all-eautomate.md`.

This document describes the **orchestrated sync** from eAutomate public APIs into the Zap PostgreSQL database. The entry point is a shell script that invokes the existing `npm run sync:*` scripts in a **dependency-safe order**.

## How to run

From the `web/` directory (after `npm install`, migrations, and `.env.local`):

```bash
npm run sync:eautomate:all
```

Equivalent:

```bash
bash scripts/sync-all-eautomate.sh
```

## Fresh Supabase (or any Postgres): wipe synced tables, then full sync

Point `DATABASE_URL` in `web/.env.local` at your **Supabase Postgres** URI (see [../deployment/web-setup.md](../deployment/web-setup.md)), run **`npm run migrate`** once so tables exist, then:

```bash
cd web
ZAP_CONFIRM_TRUNCATE_SYNC=1 npm run sync:eautomate:fresh
```

**Supabase truncate:** the wipe step needs a **direct/session** Postgres connection (port **5432**). Transaction pooler (**6543**) often hits `statement timeout` on large `TRUNCATE`. Either set `DATABASE_URL_DIRECT` in `.env.local` (Supabase → Connect → Session/direct URI), or the fresh script rewrites `:6543` → `:5432` for truncate only.

This runs `scripts/reset-eautomate-synced-data.sql` (truncates eAutomate-ingested operational tables; **keeps** users, RBAC, forms, `outbound_sold_via`) and then the same steps as `npm run sync:eautomate:all`.

- **Dry run** (no truncate, print sync commands only): `npm run sync:eautomate:fresh -- --dry-run`
- **Pass-through** to the master shell (e.g. skip heavy phases): `ZAP_CONFIRM_TRUNCATE_SYNC=1 npm run sync:eautomate:fresh -- --skip-vendor-details`

**Dry run** (print the `npm` sequence without executing):

```bash
npm run sync:eautomate:all:dry
# or
bash scripts/sync-all-eautomate.sh --dry-run
```

**Partial runs** (faster iteration or when you only need certain domains):

```bash
bash scripts/sync-all-eautomate.sh --skip-vendor-details --skip-grn-details --skip-po-details
```

**Resilience** (continue after a failing step; also passes vendor/GRN detail scripts their own `--continue-on-error` where supported):

```bash
bash scripts/sync-all-eautomate.sh --continue-on-error
```

## Required configuration

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `EAUTOMATE_COOKIE` | Full `Cookie` header from the browser (typical for authenticated eAutomate APIs) |
| `EAUTOMATE_BEARER_TOKEN` | Alternative to cookie, if the API accepts Bearer auth |
| `EAUTOMATE_LOGIN_USER_ID` / `EAUTOMATE_LOGIN_PASSWORD` | Optional; POST `/public/api/login` to obtain or **refresh** cookies after 401 (see [../services/eautomate-integration/api-reference.md](../services/eautomate-integration/api-reference.md#authentication)) |
| `EAUTOMATE_BASE_URL` | Optional; default `https://web.eautomate.in` |
| `EAUTOMATE_FETCH_TIMEOUT_MS` | Optional; used by some scripts to bound hung HTTP calls |

Copy and edit [`.env.local.example`](../../.env.local.example). The script loads `.env.local` then `.env` via the same `dotenv` preflight as other sync tools.

## What runs, and in what order

The orchestrator does **not** replace individual scripts; it only sequences them. Each step is still documented in its own file under `scripts/`.

| Order | Phase | npm script | Role |
| ----- | ----- | ---------- | ---- |
| 1 | Vendors (index) | `sync:vendors:all` | `GET /public/api/vendors/all` → `vendors` |
| 2 | Vendors (deep) | `sync:vendors:detail-all` | For each DB vendor: vendor + listings + related rows (warehouses, listings, bins, vendor links); also SKU name cache. **Many HTTP calls.** |
| 3 | Inbound PO headers | `sync:vendor-pos:all` | All purchase order headers → `vendor_purchase_orders` |
| 4 | GRN index | `sync:grns:all` | Paginated GRN list → `inbound_grns` |
| 5 | GRN queues | `sync:grns:pending-audit`, `sync:grns:pending-invoice-collection`, `sync:grns:pending-debit-credit` | Pending subsets + queue tables |
| 6 | Secondary listings | `sync:secondary-listings` | Paginated secondary listings + per-row detail POSTs (**heavy**) |
| 7 | Outbound | `sync:outbound-companies`, `sync:outbound-partial-pos`, `sync:outbound-consignments`, `verify:outbound-companies` | Companies, outbound PO partial list, consignments + delivery locations; then DB verification of company-directory rollups (same data as `GET /api/outbound/companies` summary) |
| 8 | PO line/detail | `sync:po:details:from-db` | For each `(vendor_id, po_id)` in `vendor_purchase_orders`, full PO snapshot (**many calls per PO**) |
| 9 | GRN deep ingest | `sync:grn:details:all` | For each `grn_id` in `inbound_grns`, full GRN snapshot (**eight calls per GRN**) |

## What is *not* included

These are **single-entity** or optional flows; run them manually when needed:

- **`npm run sync:vendor -- <vendorId>`** — one vendor + listings (useful for a targeted refresh).
- **`npm run sync:outbound-po-detail -- <po_number>`** — one outbound PO by number (see `scripts/sync-eautomate-outbound-po-detail.ts`).
- **`npm run repair:outbound-po-listings`** — repair misaligned commercial fields in `listings_snapshot` (inch-mark / comma title corruption). See [po-listing-commercial-field-repair.md](../services/outbound/po-listing-commercial-field-repair.md). Use `--dry-run`, `--po-number <pn>`, `--all`, or `--sync-consignment-items`.
- **SQL seeds** (`npm run seed`, `seed:forms`, demo seeds, etc.) — local fixtures, not live eAutomate.

## Runtime and risk notes

1. **Duration**: A full run can take **hours** on a large tenant (especially `sync:vendors:detail-all`, `sync:secondary-listings`, `sync:po:details:from-db`, and `sync:grn:details:all`). Use `--skip-*` flags for smoke tests.
2. **API load**: You are issuing many requests against eAutomate; prefer off-peak windows and staged runs if the provider rate-limits.
3. **Data volume**: PO/GRN detail phases scale with **row counts already in your database** from the list syncs.
4. **Failures**: By default the script **stops on the first failing `npm` exit code**. Use `--continue-on-error` for best-effort full passes; fix root causes from logs and re-run.

## Warnings log and client flagging

All sync warnings and errors during prod migration (and future runs) are tracked in:

**[prod-supabase-migration-sync-warnings.md](./prod-supabase-migration-sync-warnings.md)**

After each sync session:

1. Harvest warnings from the terminal log: `npm run harvest:sync-warnings -- /path/to/sync.log`
2. Append to the doc (review diff): `npm run harvest:sync-warnings -- /path/to/sync.log --append`
3. Update the executive summary table and **flag High/Medium items to the client**.

Severity definitions and notification checklist are in that document.

## CLI reference (`sync-all-eautomate.sh`)

| Flag | Effect |
| ---- | ------ |
| `--dry-run` | Log planned `npm run …` commands only |
| `--continue-on-error` | Do not abort the script on failure; forward `--continue-on-error` to vendor detail + GRN detail all |
| `--skip-vendor-details` | Skip `sync:vendors:detail-all` |
| `--skip-vendor-pos` | Skip `sync:vendor-pos:all` (also skips `sync:po:details:from-db` automatically) |
| `--skip-grns` | Skip `sync:grns:all` |
| `--skip-grns-pending` | Skip the three GRN “pending” syncs |
| `--skip-secondary` | Skip `sync:secondary-listings` |
| `--skip-outbound` | Skip outbound companies / partial POs / consignments (and `verify:outbound-companies`) |
| `--skip-verify-outbound-companies` | Skip `verify:outbound-companies` only (after outbound syncs; uses `DATABASE_URL`) |
| `--skip-po-details` | Skip `sync:po:details:from-db` |
| `--skip-grn-details` | Skip `sync:grn:details:all` |

Pass flags through npm with `--`:

```bash
npm run sync:eautomate:all -- --dry-run
```
