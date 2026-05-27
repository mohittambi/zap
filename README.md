# Zap (Next.js)

Logistics and operations platform — listings, inventory, inbound/outbound, catalogues, analytics. Built on **Next.js** (App Router) with **PostgreSQL** as the runtime source of truth, served through RBAC-protected **Route Handlers** under `/api`.

**Documentation index:** [docs/README.md](docs/README.md) (architecture, services, deployment, enhancements)

**Operator journeys:** [Inbound](docs/inbound-journey.md) · [Outbound](docs/outbound-journey.md)

> **Architectural rules:** before changing anything that affects data boundaries, ID allocation, or the historical import pipeline, read [**docs/zap-doctrine.md**](../docs/zap-doctrine.md) (9 principles, learned from production incidents). AI coding assistants: see [CLAUDE.md](CLAUDE.md).
>
> **Runtime note:** Zap serves production traffic entirely from its own PostgreSQL database — no live calls to eAutomate. The `sync:eautomate:*` scripts below were used for the **initial one-time historical import** and remain available for ad-hoc backfills or local development; they are not part of the request path in production.

## Setup

```bash
cp .env.local.example .env.local
# DATABASE_URL, JWT_SECRET (and optional JWT_EXPIRY)

npm install
npm run migrate
# Local only (order matters):
# npm run seed && npm run seed:forms && npm run seed:zap
# After migrations 017–020 (focus lists, catalogues, etc.):
# npm run seed:ecraft   # seeds/004_rbac_ecraft_permissions.sql + seeds/005_ecraft_defaults.sql
```

**Seeds are for local development only** (`DATABASE_URL` must point at localhost). Do not run seeds against production.

### Catalogue demo (standard list + builder grid) — optional

After migrations include `020_create_catalogues.sql` (and `021_outbound_purchase_orders.sql` for outbound POs):

1. `npm run seed:catalogue-demo` — upserts **28 standard catalogues** (IDs like `19084`…`18304`), **231 `listings`** rows (8 real MSGB* rows from [`seeds/fixtures/catalogue_demo_listings.json`](seeds/fixtures/catalogue_demo_listings.json) plus generated `ZAP-DEMO-*` SKUs), and **8 sample items** on catalogue `19084`.
2. Optional: set `CATALOGUE_LISTINGS_JSON` to a JSON file whose root is an array of listing objects (or `{ "content": [...] }`) to replace/extend listing rows; `CATALOGUE_DEMO_LISTING_TOTAL` (default `231`) controls how many rows are ensured.
3. Open `/catalogues` → choose **Standard** → click a catalogue ID → builder. Grid uses `GET /api/listings/by_page_v4?count=100`.

### Outbound — All purchase orders (demo)

After `021_outbound_purchase_orders.sql`:

1. `npm run seed:outbound-po` — upserts **companies** (channel master), **delivery locations**, and **3897** `outbound_purchase_orders` rows (first row matches [`seeds/fixtures/outbound_po_samples.json`](seeds/fixtures/outbound_po_samples.json); remaining rows are generated for pagination).
2. To load **your real first page** (e.g. 100 rows from the Network tab), save the API JSON as `{ "content": [ ... ] }` in [`seeds/fixtures/outbound_po_page1.json`](seeds/fixtures/outbound_po_page1.json), or set `OUTBOUND_PO_PAGE1_JSON` to that file path, then re-run `npm run seed:outbound-po`.
3. Open **Outbound → All Purchase Orders** (`/outbound`). API: `GET /api/outbound/purchase-orders?page=1&count=100` (optional `search=`, `wip=1`).

### Zap workbook → `003` seed (optional)

1. Place or update `zap (1).xlsx` in the `web/` directory (Numbers export: row 1 = headers, row 2 = help text, row 3+ = data).
2. Regenerate SQL: `npm run seed:generate` (reads [`scripts/seed-xlsx-mapping.json`](scripts/seed-xlsx-mapping.json); override path with `SEED_XLSX_PATH` / output with `SEED_SQL_OUT`).
3. Inspect sheets: `npm run inspect:xlsx` (or `node scripts/inspect_xlsx.mjs <file.xlsx>`).
4. Load data: `npm run seed:zap` (runs [`seeds/003_zap_from_xlsx.sql`](seeds/003_zap_from_xlsx.sql) after [`001`](seeds/001_rbac_seed.sql) and [`002`](seeds/002_forms_seed.sql)).

Rows referencing SKUs, warehouses, or vendors that are **not** present in the workbook’s `listing`, `Warehouse`, and `vendors` sheets are skipped so foreign keys stay valid. `users`, `roles`, and `listing_embeddings` are not generated from the workbook; use migrations + `001`/`002` as usual.

```bash
npm run dev    # http://localhost:3000
```

### Historical import (legacy, optional)

eAutomate was Zap's upstream system during the migration. The data has already been imported into PostgreSQL — production reads exclusively from the database and **does not** call eAutomate at request time. The scripts below are kept for the original one-time historical import and for occasional local backfills; you do not need to run or configure them to operate the app in production.

To replay the full ordered import locally (vendors → inbound POs/GRNs → secondary listings → outbound → PO/GRN detail), use:

```bash
npm run sync:eautomate:all
```

Phase-by-phase notes and safety options live in **[docs/sync-all-eautomate.md](docs/sync-all-eautomate.md)**. For a dry-run preview of commands without executing them: `npm run sync:eautomate:all:dry`.

**eAutomate login env (only needed when running these legacy import scripts):** `EAUTOMATE_LOGIN_USER_ID` and `EAUTOMATE_LOGIN_PASSWORD` in `.env.local` let the import jobs POST `{ userId, password }` to eAutomate **`/public/api/login`** and build `access_token` / `id_token` cookies, refreshing automatically on HTTP 401. With **`EAUTOMATE_WRITE_AUTH_TO_ENV_LOCAL=1`**, each successful login rewrites `EAUTOMATE_COOKIE` (and the login lines) into `.env.local` so tokens stay fresh on disk. Production deployments do not require these variables. Details: [docs/eautomate-public-api-reference.md](docs/eautomate-public-api-reference.md#authentication).

## Environment

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string (prefer a **pooled** URL on Vercel) |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRY` | Optional (default `7d`) |
| `NEXT_PUBLIC_API_URL` | Optional; only if the browser must call a different API origin |

## Auth

All routes except `POST /api/auth/login` require `Authorization: Bearer <token>` or `X-API-Key: <key>`.

- **Login:** `POST /api/auth/login` — body `{ email, password }` → `{ token, user }`
- **Current user:** `GET /api/auth/me`
- **Refresh API key:** `POST /api/auth/refresh-api-key` (admin only)

**Seed users (local only):** `admin@example.com` / `admin123` (API key `zap_seed_admin_key`); `viewer@example.com` / `viewer123`.

## Error responses

JSON `{ "error": "<message>", "code": "<optional>" }` with status `400`, `401`, `403`, `404`, or `500`.

## API routes

Base path: `/api`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/listings/sku/names` | SKU names |
| GET | `/listings/sku/:sku_id` | SKU detail + bins |
| GET | `/listings/sku/:sku_id/outbound-summary` | Aggregated PO summary + per-company rows (`listing_order_details`) |
| GET | `/listings/by_page_v4` | Paginated listings (`?search_keyword=&page=1&count=100`) |
| GET | `/listings/analytics/sku/:sku_id` | SKU analytics |
| GET | `/listings/inbound_summary/:sku_id` | Inbound summary |
| GET | `/listings/incoming-quantity/:sku_id` | Incoming quantity |
| GET | `/packs_combos/sku/:sku_id` | Pack/combo components |
| GET | `/warehouse_inventory_dump/sku_id/by_page/:sku_id` | Warehouse dump (`?page=1&count=200`) |
| GET | `/incoming_purchase_orders/listing_order_details/:sku_id` | PO details (`?page=1&count=200`) |
| GET | `/outbound/purchase-orders` | Outbound PO headers (`purchase_orders:read`). `?page=&count=` (alias `limit`), `?search=`, `?wip=1` |
| GET | `/vendors/all` | All vendors |
| GET | `/vendors/:id` | Vendor by ID |
| GET | `/vendors/listings/:vendor_id` | Vendor listings |
| GET | `/vendors/sku/:sku_id` | Vendors for SKU |
| GET | `/inventory/secondary_listings/packs_and_combos/paginated` | Paginated pack/combo IDs |
| GET | `/inventory/secondary_listings/paginated` | Paginated secondary listings |
| GET | `/inventory/secondary_listings/sku_wise_details` | `?secondary_sku=` or `?sku=` |
| GET | `/forms/categories` | Form categories |
| GET | `/forms/categories/:category` | Sub-categories |
| GET | `/forms/categories/:category/:sub_category` | Form definition |
| GET | `/forms/today/:id/:userId` | Today's submission |
| GET | `/forms/response/:id` | `?submitted_by=` |
| GET | `/warehouses` | Warehouses |
| GET | `/warehouses/:id` | Warehouse by ID |
| GET | `/bins` | Bins (`?page=&limit=&warehouse_id=&sku_id=`) |
| GET | `/bins/:id` | Bin by ID |
| GET/POST | `/focus-lists` | Focus lists (`?is_public=true|false`) |
| PATCH/DELETE | `/focus-lists/:id` | Update/delete list |
| POST/DELETE | `/focus-lists/:id/items` | Body `{ sku_id }` / `DELETE ?sku_id=` |
| GET/POST | `/catalogues` | Paginated catalogues. Defaults: `count=28`, `page=1`. Response includes `total`, `current_page`, `per_page_count`, `curr_page_count`, `content[]`. Each row has `name`, `description`, `catalogue_type` (`standard` \| `custom`) plus legacy aliases `catalogue_name`, `catalogue_description`, `catalogue_type_legacy` (`STANDARD` \| `ONETIME`). Query: `?catalogue_type=standard|custom&search_keyword=&page=&count=` |
| GET/PATCH/DELETE | `/catalogues/:id` | Catalogue CRUD |
| GET/POST/DELETE | `/catalogues/:id/items` | Items; `DELETE ?sku_id=` |
| POST | `/catalogues/:id/items/bulk-import` | `multipart/form-data` file |
| POST | `/catalogues/:id/export/pdf` | Body `{ template_id }` (default first theme id, e.g. `6021`) → PDF |
| POST | `/catalogues/:id/export/xlsx` | Excel workbook |
| GET | `/catalogue-templates` | Theme list from [`src/data/catalogue-themes.json`](src/data/catalogue-themes.json): `id`, `name`, `description`, `keywords`, `theme_pages` (image URLs) |
| GET | `/company-sku-relations` | Company ↔ secondary SKU (`?search_keyword=&page=&count=`) |
| GET | `/labels-master` | Labels master rows (`?search_keyword=&page=&count=`) |
| POST | `/labels/upload` | `multipart/form-data` field `file` (`.csv`). Validates headers against [`public/samples/eCraftZap-label-date-template.csv`](public/samples/eCraftZap-label-date-template.csv) (**17** columns) or **legacy 16** (no `qrSequence`). Returns **`application/pdf`**: 40×70mm, **90° rotation**; **EAN-13** (or Code128) as **PNG** at **bottom** (bwip-js, horizontal); **no QR**; fixed **~10mm** side margins and **8pt/7pt** text with **absolute** Y positions. Barcode uses **`barcode` only**. `labelCount` duplicates. Requires `labels:write`. |
| GET | `/bulk/export/{secondary-listings,packs-combos,ais-listings,master-sku-details}` | CSV download |
| POST | `/bulk/import/{secondary-listings,packs-combos,ais-listings}` | `multipart/form-data` file |
| GET | `/packs_combos/sku/:sku_id` | Pack/combo; add `?detail=1` for components + effective qty |

## Tests

```bash
npm run test:unit
# Terminal 1: npm run dev (with DB + seeds)
npm run test:api
```

Integration tests use `TEST_BASE_URL` (default `http://localhost:3000`).

## Deploy (Vercel)

Set **Root Directory** to `web` if the repo contains multiple folders. Configure `DATABASE_URL`, `JWT_SECRET`, etc. Run SQL migrations against production from CI or your machine, not from the Vercel build step.

## Split repo

To deploy only the frontend from this folder, copy `web/` into its own Git repository; keep `DATABASE_URL` / JWT on the server or Vercel.
