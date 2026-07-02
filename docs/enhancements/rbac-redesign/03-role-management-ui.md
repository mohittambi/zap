# Role Management UI Specification

**Status:** DRAFT FOR REVIEW  
**Last updated:** 2026-07-02  
**Audience:** Product, frontend engineers, IT administrators  
**Related:** [Permission catalog](02-permission-catalog.md) · [Technical plan](04-technical-implementation.md)

---

## Goals

1. Let administrators **add and remove permissions** on any role without a database migration.
2. Present permissions **grouped by business module** with **search** and multi-select filtering.
3. Keep **user ↔ role assignment** on the existing Users page.
4. Log every save to the **activity log** and **admin audit log**.

---

## Location in the app

| Page | Route | Purpose |
|------|-------|---------|
| **Role Management** (new) | `/settings/roles` | Edit permissions per role |
| **User Management** (existing) | `/settings/users` | Assign roles to users |
| **Activity Log** (existing) | `/settings/activity-log` | Audit permission changes |

### Navigation

Add under **Settings → Admin**:

```
Settings
└── Admin
    ├── User Management      (/settings/users)
    ├── Role Management        (/settings/roles)   ← NEW
    ├── EAN Mappings
    └── Activity Log
```

Both User Management and Role Management require admin access (`*:*` or future `roles:manage`).

### Cross-links

- On **Users** page: role badges link to Role Management editor for that role (replace read-only slide-over or add "Edit permissions" action).
- On **Role Management**: link "Assign users" → filtered Users list (optional v2).

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Settings › Role Management                                       │
├─────────────────┬────────────────────────────────────────────────┤
│ Roles           │  Role: finance                                 │
│ [Search roles…] │  Description: Finance — PO/GRN commercial…   │
│                 │                                                │
│ ● admin         │  Modules: [Searchable multi-select ▼]          │
│ ○ finance       │    ☑ Products  ☑ Inbound  ☐ Outbound  …       │
│ ○ inventory_…   │                                                │
│ ○ ops_manage…   │  Permission search: [________________]         │
│ ○ qc            │                                                │
│ ○ ops_manager   │  ▼ Inbound (expanded)                          │
│   (legacy)      │    ☑ purchase_orders:read                      │
│                 │    ☑ purchase_orders:write                     │
│                 │    ☑ grn:invoice_collect                       │
│                 │    ☐ grn:audit                                 │
│                 │    [Select all in module] [Clear module]       │
│                 │                                                │
│                 │  ▼ Products (collapsed)                        │
│                 │                                                │
│                 │  Unsaved changes: +2 / -1                      │
│                 │  [Discard]  [Save permissions]                 │
└─────────────────┴────────────────────────────────────────────────┘
```

### Left panel — role list

- All roles from `GET /api/admin/roles`, sorted by name.
- Search filters by role name or description.
- Visual distinction: **proposed** roles vs **legacy** roles (badge "legacy").
- Selecting a role loads its permissions into the editor.

### Right panel — permission editor

| Element | Behavior |
|---------|----------|
| Role name | Read-only in v1 (no create/rename role) |
| Description | Read-only in v1; sourced from `roles.description` |
| Module multi-select | Filters which permission groups are expanded; uses searchable [MultiSelect](../../../src/components/ui/multi-select.tsx) pattern (already used on outbound PO tables) |
| Permission search | Filters permissions within visible modules by resource, action, or description text |
| Permission groups | One collapsible section per module; inside, sub-groups for Products (Listings, Secondary, Bulk, …) |
| Checkboxes | Toggle `resource:action`; disabled when role is `admin` (wildcard) |
| Select all / Clear | Per module actions |
| Save | PUT permissions; show toast; log activity |
| Discard | Revert to last loaded state |

---

## Admin role special case

The `admin` role holds `*:*` wildcard.

| UI behavior | Rationale |
|-------------|-----------|
| Show banner: "Full access — wildcard permission *:*" | Clear that individual toggles are meaningless |
| Disable all checkboxes OR show all checked read-only | Prevent accidental removal of effective access |
| Do not allow removing `*:*` via UI without explicit danger flow | Avoid locking out all admins |

---

## Module filter interaction

**When no modules selected:** show all modules (or default to all expanded — product decision).

**When one or more modules selected:** only show permission groups for those modules.

**Smart expand:** selecting "Inbound" scrolls to and expands the Inbound group; permissions outside selected modules are hidden but **not** removed from the role until Save (hidden ≠ deleted).

Module IDs match [02-permission-catalog.md](02-permission-catalog.md):

`products`, `inbound`, `outbound`, `warehouse_ops`, `tools`, `insights`, `admin`

---

## Listings (Products) sub-groups

When **Products** module is active, show nested sections:

| Sub-group | Example permissions |
|-----------|---------------------|
| Warehouse listings | `listings:read`, `write`, `create`, `delete` |
| Secondary listings | `secondary_listings:read`, `manage` |
| Catalogues | `catalogues:read`, `write` |
| Focus lists | `focus_lists:read`, `write` |
| Labels | `labels:read`, `write` |
| Company SKU | `company_relations:read`, `write` |
| Bulk | `bulk:read`, `import` |
| Analytics & packs | `analytics:read`, `packs_combos:read` |

This addresses the requirement for **fine-grained listings** permissions rather than a single "Listings" toggle.

---

## API contract (proposed)

All routes require admin (`*:*`) unless `roles:manage` is introduced.

### List permission catalog

```
GET /api/admin/permissions
```

**Response:**

```json
[
  {
    "resource": "grn",
    "action": "invoice_collect",
    "description": "Mark GRN vendor invoice as collected",
    "module": "inbound",
    "subgroup": null
  },
  {
    "resource": "listings",
    "action": "write",
    "description": "Edit SKU listing details",
    "module": "products",
    "subgroup": "warehouse_listings"
  }
]
```

Module metadata may live in a static catalog file (`web/src/lib/permission-catalog.ts`) rather than DB columns on `permissions` — implementation choice in doc 04.

### List role permissions (existing)

```
GET /api/admin/roles/{name}/permissions
```

Returns `[{ resource, action, description }]`.

### Update role permissions (new)

```
PUT /api/admin/roles/{name}/permissions
Content-Type: application/json

{
  "permissions": [
    { "resource": "listings", "action": "read" },
    { "resource": "grn", "action": "invoice_collect" }
  ]
}
```

**Rules:**

- Replaces the full permission set for the role (not delta PATCH) — simpler to reason about.
- Reject PUT on `admin` role that omits `*:*` unless explicit unlock flow.
- Reject unknown `(resource, action)` pairs with 400.
- Return `{ ok: true, added: [...], removed: [...] }`.

**Errors:**

| Code | Case |
|------|------|
| 400 | Unknown permission, empty set for non-admin role |
| 403 | Non-admin caller |
| 404 | Role not found |

---

## Activity logging on save

On successful PUT, write:

**activity_log:**

```json
{
  "action": "role_permissions_updated",
  "resource": "roles",
  "resource_id": "finance",
  "details": {
    "added": ["grn:invoice_collect"],
    "removed": ["listings:write"],
    "permission_count": 24
  }
}
```

**admin_audit_log:**

```json
{
  "action": "role_permissions_updated",
  "details": { "role": "finance", "added": [...], "removed": [...] }
}
```

---

## Navigation visibility (recommended v1)

Today [app-sidebar.tsx](../../../src/components/layout/app-sidebar.tsx) only hides `adminOnly` and `superAdminOnly` items.

**Proposed rule:** hide a nav **group** when the user lacks **every** permission mapped to that group. Hide individual **items** when they need a specific permission (e.g. Bulk Operations → `bulk:read` OR `bulk:import`).

Implementation: extend [nav-groups.ts](../../../src/lib/nav-groups.ts):

```typescript
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  /** Show if user has any of these permissions */
  requiredAnyPermission?: { resource: string; action: string }[];
};
```

`filterNavSections` receives `hasPermission` from auth context and filters items/groups accordingly.

**Fallback:** users with `*:*` see everything (current admin behavior).

---

## UX details

| Concern | Approach |
|---------|----------|
| Unsaved changes | Warn on role switch or navigate away |
| Long permission lists | Virtualized or collapsed sub-groups |
| Mobile | Role Management is **web-only** (admin desktop task) |
| Accessibility | Checkboxes with labels `listings:read — View warehouse listings` |
| Loading | Skeleton in right panel while fetching role permissions |

---

## Out of scope for v1 UI

- Create / rename / delete role records
- Clone role from template
- Permission diff view between two roles
- Time-limited grants
- Per-user permission overrides (only role-based)

See [05-review-checklist.md](05-review-checklist.md) if any of these are required for launch.

---

*Next:* [Technical implementation](04-technical-implementation.md)
