# Production Supabase migration — status and runbook

**Last updated:** 2026-06-27
**Owner:** Zap engineering

This document is the **single source of truth** for the June 2026 cutover from the old Supabase project (now **development**) to the new **production** Supabase project, plus Vercel/Git deployment wiring.

Related:

- [prod-supabase-migration-sync-warnings.md](./prod-supabase-migration-sync-warnings.md) — sync warnings, client flagging, detailed incident log
- [prod-rbac-setup.md](./prod-rbac-setup.md) — production roles, permissions, admin user management
- [sync-runbook.md](./sync-runbook.md) — how to run eAutomate sync phases
- [../deployment/web-setup.md](../deployment/web-setup.md) — connection strings, pooler modes, Vercel env

---

## Environment split

| Role | Supabase project ref | Region | Used for |
| ---- | -------------------- | ------ | -------- |
| **Production** | `bxgmcddxmlsgrflnbywv` | ap-southeast-2 (Sydney) | Vercel production (`https://zap-rust.vercel.app`) |
| **Development** | `wzdvcjqjdshmcbcmsyoi` | ap-northeast-1 (Tokyo) | Local `.env.local`, Vercel Preview (unless repointed) |

**Connection modes (production):**

| Use case | Pooler | Port | Env var |
| -------- | ------ | ---- | ------- |
| Vercel runtime / serverless | Transaction | **6543** | `DATABASE_URL` on Vercel Production |
| Migrations + long sync scripts | Session | **5432** | `DATABASE_URL` or `DATABASE_URL_DIRECT` when running locally against prod |

Never commit passwords or API keys. Local prod credentials live in `web/.env.production.local` (gitignored). Vercel Production stores the same names as **Sensitive** env vars.

---

## Live URLs

| Surface | URL |
| ------- | --- |
| **Production app** | https://zap-rust.vercel.app |
| **GitHub repo** | https://github.com/mohittambi/zap |
| **Production git branch** | `main` (default branch on GitHub and Vercel production tracking) |
| **Development git branch** | `dev` (ongoing feature work; not auto-deployed to production) |

Vercel project: `zap` (`prj_4PgSHTSkfPFVYkn4u5m6ckJRkpX8`), root directory `web`.

---

## What was completed (2026-06-27)

### Database schema

- Applied all **73** SQL migrations from `web/migrations/` to production Postgres via `npm run migrate` (session/direct pooler).

### eAutomate historical sync (initial import)

| Domain | Prod row count (snapshot) | Notes |
| ------ | ------------------------- | ----- |
| Vendors | 77 | Includes re-sync of vendor **12328** (was missing after Phase 1b timeout) |
| Vendor PO headers | 1,575 | |
| GRN headers | 985 | |
| GRN detail snapshots | 984 / 984 | Phase 5b complete |
| Secondary listings | 67,183 | Resumed from page 14; concurrency-safe code merged to `main` |
| Listings | 31,377 | |
| Pack combos | 19,546 | |
| Outbound consignments | 4,043 | |
| Outbound POs | 23 | Partial outbound set from eAutomate |
| Companies (outbound) | 17 | |

**Code improvements merged to `main` (commit `14d3667`):**

- `sync-eautomate-secondary-listings.mjs`: `--start-page`, `--concurrency`, stub ID sequence (`listings_stub_id_seq`), idempotent upserts, per-parent advisory locks
- `harvest:sync-warnings` script + [prod-supabase-migration-sync-warnings.md](./prod-supabase-migration-sync-warnings.md)

### Data copied from old DB (not eAutomate)

| Table | Rows | Method |
| ----- | ---- | ------ |
| `company_ean_mappings` | 28,430 | Direct copy old dev → new prod (company IDs aligned) |
| `company_ean_column_config` | 10 | Same copy (10 marketplace columns) |

`company_secondary_sku` was **0** on both old and new — nothing to migrate.

Verify in app: **Outbound → SKU / EAN Mappings** (`/outbound/ean-mappings`).

### Supabase Storage (production)

Created via Storage API (service role):

| Bucket | Visibility | Purpose |
| ------ | ---------- | ------- |
| `listing-images` | **Public** | Listing product images (public URLs) |
| `outbound-po-files` | Private | Outbound PO attachments; signed URLs / server download |
| `inbound-grn-files` | Private | GRN / debit-note files; signed URLs / server download |

Optional env overrides: `ZAP_STORAGE_BUCKET_LISTINGS`, `ZAP_STORAGE_BUCKET_OUTBOUND`, `ZAP_STORAGE_BUCKET_INBOUND` (see [env-reference.md](../deployment/env-reference.md)).

### Vercel production environment

Repointed **Production** env vars from old dev Supabase to new prod (values in Vercel dashboard only):

- `DATABASE_URL` (transaction pooler `:6543`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (fresh prod secret — do not reuse dev)
- `SHEETS_SYNC_BEARER_TOKEN`

**Production branch:** changed from `dev` → `main` via Vercel API `PATCH /v9/projects/{id}/branch` with body `{"branch":"main"}`. Pushes/merges to `main` now trigger production deployments.

### Production admin login and RBAC

See **[prod-rbac-setup.md](./prod-rbac-setup.md)** for the full role matrix and admin workflows.

| User | Email | Role |
| ---- | ----- | ---- |
| Saumya | `saumya@ecraftindia.com` | `admin` |
| Ankit | `ankit@ecraftindia.com` | `admin` |
| Bootstrap | `admin@zap.app` | `admin` (optional; rotate or deactivate when team accounts are in use) |

**Migration 073** assigns `bins:manage`, `forms:write`, `query_builder:read`, and `vendors:delete` to business roles (`ops_manager`, `warehouse_staff`, `finance`, `sales` as documented).

**Admin controls:** Settings → Users (`/settings/users`) — create users, assign roles, reset passwords (invalidates sessions), activate/deactivate.

Passwords are generated at setup via `node scripts/seed-prod-admin-users.mjs` — never commit; store in team vault.

### Git

- Migration tooling committed on `dev`, pushed, then `main` created from same tip and pushed.
- GitHub default branch: **`main`**.

---

## Sync completion (2026-06-27)

| Domain | Prod count | Status |
| ------ | ---------- | ------ |
| eAutomate PO headers | 1,575 (1,574 eAutomate + 1 zap) | ✅ |
| PO detail snapshots | **1,574 / 1,574** | ✅ |
| PO detail lines | **9,371** | ✅ |
| PO detail GRN links | **986** | ✅ |
| Ops SKU PO metrics | **3,346** | ✅ |

Final PO pass: **489 ok, 0 failed** at concurrency 4. No half-written rows (`snapshot_without_lines: 0`).

**Env pitfall fixed:** `refresh-ops-master-sku-po-metrics.ts` no longer overrides a shell-set `DATABASE_URL` with `.env.local` (dev). Always `export DATABASE_URL=<prod session :5432>` before prod sync/metrics scripts.

## Optional follow-ups (not blocking prod)

| Item | Status |
| ---- | ------ |
| Residual warehouse ingest warnings | Optional — see W-005, W-007 in [warnings doc](./prod-supabase-migration-sync-warnings.md) |
| User/RBAC (Saumya, Ankit admins + role permissions) | ✅ Done — [prod-rbac-setup.md](./prod-rbac-setup.md) |
| Commit local doc + script changes to `main` | Pending |

---

## Verification checklist

```bash
cd web
export DATABASE_URL="<prod session pooler :5432>"

# Row counts (adjust table list as needed)
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const t of [
    'vendors', 'vendor_purchase_orders', 'inbound_po_detail_snapshot',
    'inbound_grns', 'secondary_listings', 'company_ean_mappings',
    'ops_master_sku_po_metrics'
  ]) {
    const r = await c.query('select count(*)::int n from ' + t);
    console.log(t, r.rows[0].n);
  }
  await c.end();
})();
"

# Production HTTP
curl -s -o /dev/null -w "%{http_code}\n" https://zap-rust.vercel.app/login
```

---

## Business status update (WhatsApp / stakeholder template)

Copy and adjust counts before sending:

```
Production migration update:

✅ New Supabase production (Sydney) live
✅ Schema migrated; main eAutomate data synced (vendors, POs, GRNs, 67k+ secondary listings, outbound)
✅ SKU/EAN mappings synced (28,430 rows)
✅ Storage buckets created; Vercel prod on https://zap-rust.vercel.app
✅ Production deploys from main branch; admin login configured

✅ PO line-detail sync complete (1,574 POs, 9,371 lines)
✅ Ops SKU metrics on prod (3,346 rows)

App is fully usable in production. Team admin accounts (Saumya, Ankit) and role permissions are configured — see Settings → Users.
```

---

## Operator commands reference

| Task | Command |
| ---- | ------- |
| Full eAutomate sync (local, long) | `npm run sync:eautomate:all` |
| PO details from DB PO list | `npm run sync:po:details:from-db` |
| Missing PO details only | `npm run sync:po:details:missing` |
| Ops metrics rebuild | `npm run refresh:ops-sku-po-metrics` |
| Secondary listings resume | `npm run sync:secondary-listings -- --start-page N --concurrency 8` |
| Harvest sync warnings from log | `npm run harvest:sync-warnings -- path/to.log` |
| EAN from XLSX (alternative to DB copy) | `npm run seed:ean-mappings` |

Always point `DATABASE_URL` at the **intended** project (prod vs dev) before running sync scripts.

---

## Changelog

| Date (UTC) | Change |
| ---------- | ------ |
| 2026-06-27 | RBAC migration 073, Saumya/Ankit admins, [prod-rbac-setup.md](./prod-rbac-setup.md) |
| 2026-06-27 | PO details + ops metrics marked complete; refresh script env fix documented |
