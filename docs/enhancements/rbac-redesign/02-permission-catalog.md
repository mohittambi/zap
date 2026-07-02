# Permission Catalog

**Status:** DRAFT FOR REVIEW  
**Last updated:** 2026-07-02  
**Audience:** IT administrators, backend engineers, security reviewers  
**Related:** [Business roles](01-business-roles-proposal.md) · [Role Management UI](03-role-management-ui.md) · [Auth overview](../../services/auth/overview.md)

---

## How permissions work

Each permission is a **`resource:action`** pair stored in the `permissions` table and linked to roles via `role_permissions`.

Authorization at runtime:

```typescript
// web/src/server/rbac.ts
hasPermission(user, resource, action)
// true if exact match OR user has *:*
```

Users with multiple roles receive the **union** of all permissions from those roles.

---

## Module groups (UI + documentation)

Module groups align with navigation in [nav-groups.ts](../../../src/lib/nav-groups.ts). The Role Management UI filters permissions by module.

| Module ID | Label | Nav / features |
|-----------|-------|----------------|
| `products` | Products | Listings, catalogues, labels, focus lists, bulk, analytics |
| `inbound` | Inbound | Vendors, inbound POs, GRNs, finance queues, GRN elevated steps |
| `outbound` | Outbound | Outbound POs, consignments, boxes, pending invoices, EAN mappings |
| `warehouse_ops` | Warehouse & Ops | Warehouses, bins, scan/outward, inventory logs, reorder, ops SKU control |
| `tools` | Tools | Forms, flows, legacy purchase-order reports |
| `insights` | Insights | Decision intelligence (super-admin email allowlist may still apply) |
| `admin` | Admin | Users, roles, activity log, EAN mappings admin |

---

## Existing permission catalog (production today)

Sourced from seeds and migrations through `077_*`.

### Wildcard

| Permission | Description | Typical roles |
|------------|-------------|---------------|
| `*:*` | Full access to every resource and action | `admin` only |

### Products module

| Permission | Description | Source |
|------------|-------------|--------|
| `listings:read` | View warehouse listings, SKU detail | 001 |
| `listings:write` | Edit SKU listing fields (PATCH) | 045 |
| `analytics:read` | SKU analytics and movement | 001 |
| `packs_combos:read` | Pack/combo definitions | 001 |
| `secondary_listings:read` | Secondary listings, logs, my-logs | 052 |
| `secondary_listings:manage` | Secondary company associations, labels | 052 |
| `catalogues:read` | Catalogue list and detail | 004 |
| `catalogues:write` | Create/update catalogues and items | 004 |
| `focus_lists:read` | View focus lists | 004 |
| `focus_lists:write` | Create/edit focus lists | 004 |
| `labels:read` | Labels master data | 004 |
| `labels:write` | Edit labels master | 004 |
| `company_relations:read` | Company–secondary SKU relations | 004 |
| `company_relations:write` | Edit company–SKU relations | 004 |
| `bulk:read` | Bulk CSV export | 004 |
| `bulk:import` | Bulk CSV import (secondary, AIS, packs) | 004 |

**Admin-only today (not permission-gated):**

| Action | Route | Current gate |
|--------|-------|--------------|
| Create master listing | `POST /api/listings` | `assertAdmin` (`*:*`) |
| Soft-delete listing | `DELETE /api/listings/sku/{sku_id}` | `assertAdmin` |
| Bulk import master listings | `POST /api/bulk/import/master-listings` | `assertAdmin` |

### Inbound module

| Permission | Description | Source |
|------------|-------------|--------|
| `vendors:read` | Vendor directory | 001 |
| `vendors:create` | Create vendors | 022 |
| `vendors:write` | Update vendor profiles | 045 |
| `vendors:delete` | Delete vendors | 045, 073 → `ops_manager` |
| `purchase_orders:read` | View inbound/outbound POs, GRNs | 001 |
| `purchase_orders:create` | Create inbound POs, outbound POs | 024 |
| `purchase_orders:write` | Update GRNs, upload files, receive inventory | 045 |

**Admin role name only today (not permission-gated):**

| Action | Route | Current check |
|--------|-------|-----------------|
| Mark GRN audited | `PATCH /api/inbound/grns/{grnId}` | `user.roles.includes("admin")` |
| Approve/reject accounts | same | same |
| Collect invoice | same | same |
| Accept/decline debit/credit | `POST .../pending-debit-credit/notes/{noteId}/decision` | `user.roles.includes("admin")` |

### Outbound module

Outbound reuses `purchase_orders:*` for most routes (read/create/write). Examples:

| Route | Permission |
|-------|------------|
| `GET /api/outbound/purchase-orders` | `purchase_orders:read` |
| `POST /api/outbound/purchase-orders` | `purchase_orders:create` |
| Consignment invoice upload | `purchase_orders:write` |
| Consignment invoice XLSX | `purchase_orders:read` |

### Warehouse & Ops module

| Permission | Description | Source |
|------------|-------------|--------|
| `warehouses:read` | Warehouses list and detail | 001 |
| `bins:read` | Bins list and detail | 001 |
| `bins:write` | Scan & Update ADD/REMOVE, bin outward, assignments | 045 |
| `bins:manage` | Create or delete bin locations | 061, 073 |
| `warehouse_inventory:read` | Warehouse inventory dump / log | 001 |
| `inventory:read` | Secondary/platform inventory views | 001 |
| `inventory:write` | Inventory label mutations | 045 |

**GRN inventory receipt** (book into bins):

| Route | Permission today |
|-------|------------------|
| `POST /api/inbound/grns/{grnId}/receive-inventory` | `purchase_orders:write` |

### Tools module

| Permission | Description | Source |
|------------|-------------|--------|
| `forms:read` | View forms | 001 |
| `forms:write` | Submit/manage form responses | 045, 073 |
| `query_builder:read` | Dashboard query builder | 070, 073 |

### Insights module

| Permission | Description | Source |
|------------|-------------|--------|
| `insights:read` | Decision intelligence hub | 074 |
| `insights:manage` | Configure insights, feedback, digest | 074 |

Note: Insights UI may also require `SUPER_ADMIN_EMAILS` allowlist — separate from RBAC.

### Admin module

| Permission | Description | Notes |
|------------|-------------|-------|
| `*:*` | User management, activity log, API docs | Today all admin routes use `assertPermission(user, "*", "*")` or `assertAdmin` |

---

## New permissions (proposed — migration required)

These replace hard-coded admin checks and enable fine-grained Role Management.

| Permission | Description | Replaces | Default grant (proposed) |
|------------|-------------|----------|--------------------------|
| `listings:create` | Create master SKU | `assertAdmin` on `POST /api/listings` | `admin`, `merchandising` ⚠️ |
| `listings:delete` | Soft-delete master listing | `assertAdmin` on `DELETE /api/listings/sku/{id}` | `admin` |
| `grn:audit` | Mark GRN audit complete (terminal audit status) | `roles.includes("admin")` on GRN PATCH | `admin` ⚠️ finance |
| `grn:accounts_approve` | Approve or reject GRN accounts | same | `admin` ⚠️ finance |
| `grn:invoice_collect` | Mark GRN invoice collected | same | `admin`, `finance` **confirmed** |
| `debit_credit:decide` | Accept/decline pending debit/credit note | `roles.includes("admin")` on decision route | `admin` ⚠️ finance |
| `roles:manage` | Edit role permission assignments | implicit `*:*` | `admin` only (optional explicit tuple) |

**Bulk master import:** map to `listings:create` **and** `bulk:import` (both required) or introduce `listings:import` — **review in checklist**.

---

## Listings fine-grained matrix

Sub-groups shown in Role Management UI under **Products**:

| Sub-group | Permissions | Web surfaces |
|-----------|-------------|--------------|
| Warehouse listings | `listings:read`, `write`, `create`, `delete` | `/listings/warehouse`, `/listings/{skuId}`, create dialog |
| Secondary listings | `secondary_listings:read`, `manage` | `/listings/secondary`, company associations API |
| Catalogues | `catalogues:read`, `write` | `/catalogues` |
| Focus lists | `focus_lists:read`, `write` | `/listings/focus` |
| Labels | `labels:read`, `write` | `/labels`, `/listings/labels-master` |
| Company SKU | `company_relations:read`, `write` | `/listings/company-sku` |
| Bulk operations | `bulk:read`, `import` | `/listings/bulk` |
| Analytics & packs | `analytics:read`, `packs_combos:read` | SKU analytics, `/listings/packs-combos` |

### API mapping (key routes)

| Methods | Path | Permission |
|---------|------|------------|
| GET | `/api/listings/by_page_v4` | `listings:read` |
| GET, PATCH | `/api/listings/sku/[sku_id]` | `read` / `write` |
| POST | `/api/listings` | `listings:create` (proposed) |
| DELETE | `/api/listings/sku/[sku_id]` | `listings:delete` (proposed) |
| GET | `/api/inventory/secondary_listings/paginated` | `inventory:read` |
| PATCH | `/api/inventory/secondary_listings/labels` | `secondary_listings:manage` |
| POST/PATCH/DELETE | `/api/inventory/secondary_listings/companies` | `secondary_listings:manage` |
| GET | `/api/inventory/my-logs` | `secondary_listings:read` |
| GET | `/api/bulk/export/*` | `bulk:read` |
| POST | `/api/bulk/import/master-listings` | `listings:create` + `bulk:import` (proposed) |
| POST | `/api/bulk/import/secondary-listings` | `bulk:import` |

Full listings API index: [services/listings/api.md](../../services/listings/api.md).

---

## Inbound elevated permissions (proposed)

| Permission | UI queue / action | API |
|------------|-------------------|-----|
| `grn:audit` | Pending Audits → Confirm Audit | `PATCH /api/inbound/grns/{grnId}` with terminal `grn_audit_status` |
| `grn:accounts_approve` | Pending Accounts → Approve/Reject | same with `accounts_status` APPROVED/REJECTED |
| `grn:invoice_collect` | Pending Invoice Collection → Collected | same with `grn_invoice_collection_status` COLLECTED |
| `debit_credit:decide` | Pending Debit & Credit → Accept/Decline | `POST .../notes/{noteId}/decision` |

Activity log actions (existing): `grn_audited`, `grn_invoice_collected`, `grn_accounts_updated`.

---

## Warehouse ops bundle (Inventory Management — confirmed)

| Permission | Feature |
|------------|---------|
| `bins:read` | Bins list, bin detail, bin changes |
| `bins:write` | Scan & Update (`POST /api/bins/scan-update`), Bin Outward |
| `bins:manage` | Create/delete bin locations |
| `warehouses:read` | Warehouses page |
| `warehouse_inventory:read` | Warehouse Inventory Log |
| `inventory:read` | SKU-wise inventory |
| `purchase_orders:write` | GRN receive-inventory (`POST .../receive-inventory`) |
| `listings:read` | Product reference |
| `secondary_listings:read` | Secondary listing reference (recommended) |

---

## Default permission seeds per proposed role

⚠️ = requires sign-off in [05-review-checklist.md](05-review-checklist.md).

### `inventory_management`

| Module | Permissions |
|--------|-------------|
| products | `listings:read`, `secondary_listings:read`, `analytics:read`, `packs_combos:read` |
| warehouse_ops | `bins:read`, `bins:write`, `bins:manage`, `warehouses:read`, `warehouse_inventory:read`, `inventory:read` |
| inbound | `purchase_orders:read`, `purchase_orders:write` (receive-inventory only in practice) |

### `finance`

| Module | Permissions |
|--------|-------------|
| products | `listings:read`, `analytics:read`, `bulk:read` |
| inbound | `purchase_orders:read`, `purchase_orders:write`, `vendors:read`, `vendors:write`, `grn:invoice_collect` **confirmed**, `grn:audit` ⚠️, `grn:accounts_approve` ⚠️, `debit_credit:decide` ⚠️ |
| tools | `forms:write`, `query_builder:read` |

### `ops_management`

| Module | Permissions |
|--------|-------------|
| products | `listings:read`, `secondary_listings:read`, `analytics:read`, `packs_combos:read` |
| outbound | `purchase_orders:read`, `create` ⚠️, `write` |
| warehouse_ops | Full inventory_management bundle |
| inbound | — ⚠️ (default none) |
| tools | `forms:write`, `query_builder:read` |

### `qc`

| Module | Permissions |
|--------|-------------|
| products | `listings:read`, `secondary_listings:read` |
| inbound | `purchase_orders:read`, `create` ⚠️, `write` ⚠️, `vendors:read` ⚠️ |

### `admin`

| Permission |
|------------|
| `*:*` (wildcard — supersedes all tuples) |

---

## Legacy role permissions (reference — unchanged in v1)

Current seeds in migration `045` and `073` remain valid for: `ops_manager`, `warehouse_staff`, `finance`, `merchandising`, `sales`, `viewer`, `warehouse_manager`, `vendor`.

See [prod-rbac-setup.md](../../operations/prod-rbac-setup.md) for the post-073 matrix.

---

## Permission → navigation visibility (recommended)

A nav group is **shown** if the user has **at least one** permission mapped to that module. Example mapping:

| Nav group ID | Any of these permissions |
|--------------|--------------------------|
| `products` | `listings:read`, `catalogues:read`, `labels:read`, … |
| `inbound` | `vendors:read`, `purchase_orders:read`, `grn:*`, … |
| `outbound` | `purchase_orders:read` (outbound context) |
| `warehouse-ops` | `bins:read`, `warehouses:read`, `warehouse_inventory:read`, `inventory:read` |
| `settings` | `*:*` or `roles:manage` |

Detail: [03-role-management-ui.md](03-role-management-ui.md).

---

*Next:* [Role Management UI](03-role-management-ui.md) · [Technical implementation](04-technical-implementation.md)
