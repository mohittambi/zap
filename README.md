# Zap (Next.js)

eautomate API mirror — listings, inventory, analytics. Data from PostgreSQL. RBAC-protected **Next.js Route Handlers** under `/api`.

## Setup

```bash
cp .env.local.example .env.local
# DATABASE_URL, JWT_SECRET (and optional JWT_EXPIRY)

npm install
npm run migrate
# Local only: npm run seed && npm run seed:forms
```

**Seeds are for local development only** (`DATABASE_URL` must point at localhost). Do not run seeds against production.

```bash
npm run dev    # http://localhost:3000
```

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
| GET | `/listings/by_page_v4` | Paginated listings (`?search_keyword=&page=1&count=100`) |
| GET | `/listings/analytics/sku/:sku_id` | SKU analytics |
| GET | `/listings/inbound_summary/:sku_id` | Inbound summary |
| GET | `/listings/incoming-quantity/:sku_id` | Incoming quantity |
| GET | `/packs_combos/sku/:sku_id` | Pack/combo components |
| GET | `/warehouse_inventory_dump/sku_id/by_page/:sku_id` | Warehouse dump (`?page=1&count=200`) |
| GET | `/incoming_purchase_orders/listing_order_details/:sku_id` | PO details (`?page=1&count=200`) |
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
