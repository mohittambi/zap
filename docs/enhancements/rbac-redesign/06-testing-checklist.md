# RBAC Testing Checklist

**Status:** IN PROGRESS  
**Last updated:** 2026-07-02  
**Audience:** QA, engineering, module owners  
**Related:** [Permission catalog](02-permission-catalog.md) · [Technical implementation](04-technical-implementation.md)

---

## Prerequisites

1. Migration `078_rbac_fine_grained_permissions.sql` applied (dev + prod).
2. Seed RBAC test users on **dev** only:

```bash
cd web
psql "$DATABASE_URL" -f tests/fixtures/rbac_test_users.sql
```

3. Test users (password `rbac123` for all):

| Email | Role |
|-------|------|
| `rbac-admin@test.local` | `admin` |
| `rbac-inv@test.local` | `inventory_management` |
| `rbac-ops@test.local` | `ops_management` |
| `rbac-qc@test.local` | `qc` |
| `rbac-finance@test.local` | `finance` |
| `rbac-viewer@test.local` | `viewer` |
| `rbac-merch@test.local` | `merchandising` |
| `rbac-none@test.local` | *(no roles)* |

4. Optional elevated GRN fixtures: set `grnId` and `noteId` in [`tests/fixtures/rbac_test_ids.json`](../../../tests/fixtures/rbac_test_ids.json).
5. After role changes, users must **re-login** for JWT permission refresh.

---

## Automated tests

| Command | What it covers |
|---------|----------------|
| `npm run test:unit` | Catalog/nav parity, DB role seeds, route manifest drift |
| `npm run test:api` | Permission matrix (requires `npm run dev` or `TEST_BASE_URL`) |

Key files:

- [`tests/fixtures/rbac-permission-routes.json`](../../../tests/fixtures/rbac-permission-routes.json) — one route per permission
- [`tests/api/rbac-permission-matrix.test.mjs`](../../../tests/api/rbac-permission-matrix.test.mjs) — forbid/allow HTTP matrix
- [`tests/unit/rbac-db-parity.test.ts`](../../../tests/unit/rbac-db-parity.test.ts) — DB vs catalog vs migration 078

---

## Permission matrix (automated + manual)

| Permission | Module | API (auto) | Nav | UI action | Mobile | Pass | Tester | Date |
|------------|--------|------------|-----|-----------|--------|------|--------|------|
| `listings:read` | products | auto | manual | manual | — | | | |
| `listings:write` | products | auto | manual | manual | — | | | |
| `listings:create` | products | auto | manual | manual | — | | | |
| `listings:delete` | products | auto | manual | manual | — | | | |
| `analytics:read` | products | auto | manual | — | — | | | |
| `packs_combos:read` | products | auto | manual | — | — | | | |
| `secondary_listings:read` | products | auto | manual | — | — | | | |
| `secondary_listings:manage` | products | auto | manual | manual | — | | | |
| `catalogues:read` | products | auto | manual | — | — | | | |
| `catalogues:write` | products | auto | manual | manual | — | | | |
| `focus_lists:read` | products | auto | manual | — | — | | | |
| `focus_lists:write` | products | auto | manual | manual | — | | | |
| `labels:read` | products | auto | manual | — | — | | | |
| `labels:write` | products | auth/can | manual | manual | — | | | |
| `company_relations:read` | products | auto | manual | — | — | | | |
| `company_relations:write` | products | auth/can | manual | manual | — | | | |
| `bulk:read` | products | auto | manual | — | — | | | |
| `bulk:import` | products | auto | manual | manual | — | | | |
| `vendors:read` | inbound | auto | manual | — | — | | | |
| `vendors:create` | inbound | auto | manual | manual | — | | | |
| `vendors:write` | inbound | auto | manual | manual | — | | | |
| `vendors:delete` | inbound | auto | manual | — | — | | | |
| `purchase_orders:read` | inbound/outbound | auto | manual | — | — | | | |
| `purchase_orders:create` | inbound/outbound | auto | manual | manual | — | | | |
| `purchase_orders:write` | inbound | auto | manual | manual | mobile | | | |
| `grn:audit` | inbound | auto* | manual | manual | mobile | | | |
| `grn:accounts_approve` | inbound | auto* | manual | manual | mobile | | | |
| `grn:invoice_collect` | inbound | auto* | manual | manual | mobile | | | |
| `debit_credit:decide` | inbound | auto* | manual | manual | — | | | |
| `warehouses:read` | warehouse_ops | auto | manual | — | — | | | |
| `bins:read` | warehouse_ops | auto | manual | — | — | | | |
| `bins:write` | warehouse_ops | auto | manual | manual | — | | | |
| `bins:manage` | warehouse_ops | auto | manual | manual | — | | | |
| `warehouse_inventory:read` | warehouse_ops | auto | manual | — | — | | | |
| `inventory:read` | warehouse_ops | auto | manual | — | — | | | |
| `inventory:write` | warehouse_ops | auth/can | manual | — | — | | | |
| `forms:read` | tools | auto | manual | — | — | | | |
| `forms:write` | tools | auth/can | manual | manual | — | | | |
| `query_builder:read` | tools | auto | manual | — | — | | | |
| `insights:read` | insights | auth/can | manual† | — | — | | | |
| `insights:manage` | insights | auth/can | manual† | — | — | | | |
| `*:*` | admin | auto | manual | manual | — | | | |

\* Elevated GRN/debit-credit API tests skip until `rbac_test_ids.json` has real IDs.  
† Insights **API** uses `assertSuperAdmin`; nav may use email allowlist separately.

---

## Module walkthrough (manual)

### Products

- [ ] `/listings/warehouse` — `rbac-viewer` sees list; `rbac-merch` can edit
- [ ] Create listing — `rbac-merch` only
- [ ] `/catalogues`, `/labels`, bulk import/export

### Inbound

- [ ] `/inbound` vendors — `rbac-qc` read; create vendor blocked for viewer
- [ ] `/inbound/pending-audits` — visible only with `grn:audit`
- [ ] `/inbound/pending-invoice-collection` — `rbac-finance`
- [ ] `/inbound/pending-accounts` — `grn:accounts_approve`
- [ ] `/inbound/pending-debit-credit` — `debit_credit:decide`

### Outbound

- [ ] `/outbound` PO list — `rbac-ops` yes, `rbac-inv` no
- [ ] Create outbound PO — `rbac-ops`

### Warehouse & Ops

- [ ] `/bins`, scan-update, outward — `rbac-inv`
- [ ] Create bin — `bins:manage` on `rbac-inv`

### Tools

- [ ] Forms categories — `rbac-viewer` read
- [ ] Query builder — `rbac-ops`

### Insights

- [ ] Hub visible per super-admin email allowlist (separate from `insights:read` permission)

### Admin

- [ ] `/settings/roles` — admin only; save permission toggle + activity log
- [ ] `/settings/users` — role badges link to Role Management

---

## Role smoke scripts

### `inventory_management` (`rbac-inv@test.local`)

| Expect | Nav / action |
|--------|----------------|
| Yes | Listings read, bins, warehouses, inbound GRN write (receipt) |
| No | Outbound module, pending finance queues, Role Management |

### `ops_management` (`rbac-ops@test.local`)

| Expect | Nav / action |
|--------|----------------|
| Yes | Outbound POs, bins, query builder |
| No | `grn:audit`, Role Management |

### `qc` (`rbac-qc@test.local`)

| Expect | Nav / action |
|--------|----------------|
| Yes | Inbound vendors read, PO/GRN workflows |
| No | Finance queues, outbound, bins manage |

### `finance` (`rbac-finance@test.local`)

| Expect | Nav / action |
|--------|----------------|
| Yes | Pending invoice collection |
| No | Pending audits/accounts (unless manually assigned) |

---

## Edge cases

- [ ] User with `admin` + business role → full access (`*:*`)
- [ ] User with `qc` + `finance` → union of permissions
- [ ] Change role in UI → re-login required for JWT
- [ ] Legacy `warehouse_staff` / `merchandising` unchanged
- [ ] PUT `/api/admin/roles/admin/permissions` → 400

---

## Mobile (`InboundGrnActions.tsx`)

| Action | `rbac-finance` | `rbac-qc` |
|--------|----------------|-----------|
| Audit | hidden | hidden |
| Invoice collect | visible | hidden |
| Accounts approve | hidden | hidden |

---

## Prod verification (read-only)

Run after deploy. **No write tests on prod.**

```sql
SELECT resource, action FROM permissions
WHERE resource IN ('grn','debit_credit')
   OR (resource = 'listings' AND action IN ('create','delete'))
ORDER BY resource, action;

SELECT name FROM roles
WHERE name IN ('inventory_management','ops_management','qc');

SELECT p.resource, p.action FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'finance' AND p.resource = 'grn';
```

UI: one admin session — `/settings/roles` loads all modules.

---

## Automated run log

| Check | Dev | Prod | Date |
|-------|-----|------|------|
| `rbac_test_users.sql` seeded | Pass | N/A (dev only) | 2026-07-02 |
| `rbac-db-parity` unit tests | Pass (with DATABASE_URL) | — | 2026-07-02 |
| `rbac-route-manifest` unit tests | Pass | — | 2026-07-02 |
| `rbac-permission-matrix` API tests | Pass (128/128) | N/A | 2026-07-02 |
| SQL parity queries | Pass | Pass | 2026-07-02 |

---

*Back to:* [Review pack hub](README.md)
