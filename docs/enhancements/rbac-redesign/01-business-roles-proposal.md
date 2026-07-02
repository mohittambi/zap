# Business Roles Proposal

**Status:** DRAFT FOR REVIEW  
**Last updated:** 2026-07-02  
**Audience:** Ops leads, HR, compliance, IT administrators (no coding knowledge required)  
**Related:** [Review pack hub](README.md) · [Permission catalog](02-permission-catalog.md) · [Current roles guide](../../business/roles-and-access.md)

---

## Why we are changing roles

Zap's current roles (`ops_manager`, `warehouse_staff`, `finance`, etc.) were designed for an earlier org structure. The business now needs four clearer job functions — **Inventory Management**, **Finance**, **Operation Management**, and **QC** — with permissions that IT can **tune without a developer** after initial setup.

This document describes those roles in plain language. Technical permission names are in [02-permission-catalog.md](02-permission-catalog.md).

---

## Proposed roles

| DB role name (proposed) | Business name | Who typically gets this |
|-------------------------|---------------|-------------------------|
| `inventory_management` | Inventory Management | Warehouse inventory team, stock controllers |
| `finance` | Finance / Accounts | AP/AR, accounts payable, finance ops |
| `ops_management` | Operation Management | Logistics leads, outbound coordinators |
| `qc` | QC | Quality control, inbound inspection |
| `admin` | Administrator | IT leads, senior ops managers |

Users may hold **more than one role**; they receive the **combined** permissions of all assigned roles.

---

## Inventory Management

**Purpose:** Own stock accuracy — see all inventory, add/remove quantities, manage bin locations, and book inbound goods into bins after finance approval.

### What they can do (confirmed)

| Area | Capability |
|------|------------|
| **Warehouse & Ops** | Scan & Update (ADD/REMOVE quantities in bins) |
| | Bin Outward (dispatch stock from bins) |
| | Create and delete bin locations |
| | View warehouses, bin list, bin change history |
| **Inventory views** | Warehouse Inventory Log, SKU-wise inventory |
| **Inbound** | Book GRN quantities into bins after accounts approval (inventory receipt step) |
| **Products** | View listings (read-only) — product reference while handling stock |

### What they typically cannot do

- Edit product listing content (pricing, descriptions, images) — unless given extra permissions
- Acknowledge or cancel outbound channel orders
- Mark GRNs as audited, approve accounts, or collect vendor invoices (finance steps)
- Manage user accounts or role permissions

### Modules visible (proposed)

- **Products** — listings (read)
- **Warehouse & Ops** — full
- **Inbound** — GRN detail for inventory receipt only (not full finance queues unless granted)

---

## Finance

**Purpose:** Handle commercial and compliance steps on inbound goods — invoices, pending debit/credit notes, audit history — plus read product data for reference.

### What they can do (confirmed + proposed)

| Area | Capability | Status |
|------|------------|--------|
| **Inbound queues** | Pending Invoice Collection | Proposed default |
| | Pending Debit & Credit | View; decide ⚠️ REVIEW |
| | Pending Audits | View; complete audit ⚠️ REVIEW |
| | Pending Accounts | View; approve/reject ⚠️ REVIEW |
| **Invoices** | **Mark GRN invoice as collected** | **Confirmed** |
| **GRN history** | GRN activity log on detail pages | Proposed default |
| **Products** | View listings (read-only) | Proposed default |
| **Reports** | Bulk export (read), dashboard queries | Proposed default |

### What they typically cannot do

- Bin scan updates or outward movements (inventory team)
- Create outbound POs or dispatch consignments
- Edit product listings
- Manage users or roles (unless also `admin`)

### Modules visible (proposed)

- **Products** — listings (read)
- **Inbound** — core POs/GRNs + finance queues
- **Not Outbound** — unless explicitly granted

---

## Operation Management

**Purpose:** Run outbound fulfilment end-to-end while retaining full inventory-management capabilities for operational flexibility.

### What they can do (proposed)

| Area | Capability | Status |
|------|------------|--------|
| **Outbound** | View and manage outbound POs, consignments, boxes | Proposed default |
| | Create POs, acknowledge/cancel | ⚠️ REVIEW |
| | Pending outbound invoices, labels, EAN mappings | Proposed default |
| **Warehouse & Ops** | Same bundle as Inventory Management | Confirmed intent |
| **Products** | View listings (read-only) | Proposed default |
| **Inbound** | Any inbound access | ⚠️ REVIEW — default **none** |

### What they typically cannot do

- Finance approval steps (unless granted `grn:*` permissions)
- Edit product catalog (merchandising)
- User/role administration

### Modules visible (proposed)

- **Products** — listings (read)
- **Outbound** — full
- **Warehouse & Ops** — full
- **Inbound** — optional per sign-off

---

## QC

**Purpose:** Quality control on inbound goods and product reference via listings.

### What they can do (proposed — scope TBD)

| Area | Capability | Status |
|------|------------|--------|
| **Products** | View listings (read-only) | Proposed default |
| **Inbound** | View inbound POs and GRNs | Proposed default |
| | Raise or edit GRNs | ⚠️ REVIEW |
| | Enter accepted/rejected/shortage on lines | ⚠️ REVIEW |
| | Close GRN | ⚠️ REVIEW |
| | Mark audit complete | ⚠️ REVIEW — likely **no** |
| | Book inventory into bins | ⚠️ REVIEW — likely **no** |

### What they typically cannot do

- Outbound operations
- Finance queues (unless granted)
- Bin mutations (unless granted inventory bundle)

### Modules visible (proposed)

- **Products** — listings (read)
- **Inbound** — scope per sign-off in [05-review-checklist.md](05-review-checklist.md)

---

## Administrator

**Purpose:** Full platform access and governance.

### What they can do

- Everything any other role can do (via `*:*` wildcard permission)
- **Settings → Users** — create, deactivate, reset passwords, assign roles
- **Settings → Role Management** (new) — add/remove permissions on any role
- **Settings → Activity Log** — full audit trail
- All inbound elevated steps by default until reassigned to other roles

### Safeguards (existing + proposed)

- Cannot remove own `admin` role or deactivate own account
- Cannot remove last admin user in the system
- Role permission changes logged to activity log and admin audit log

---

## Legacy roles (current production)

These roles **remain in the database today** and may still be assigned to users:

| DB role | Business name | Notes |
|---------|---------------|-------|
| `ops_manager` | Operations Manager | Broad inbound/outbound ops |
| `warehouse_staff` | Warehouse Staff | GRNs, bins, picking |
| `finance` | Finance / Accounts | **Same name** as proposed role — may merge or coexist |
| `merchandising` | Merchandising / Category | Listings edit, catalogues |
| `sales` | Sales / Key Accounts | Read-focused outbound visibility |
| `viewer` | Read-only viewer | All `*:read` permissions |
| `warehouse_manager` | Warehouse manager (legacy) | Partial overlap with warehouse_staff |
| `vendor` | Vendor portal | Vendor directory read |

### Rollout options

**Option A — Recommended:** Add four new roles (`inventory_management`, `ops_management`, `qc`; extend or duplicate `finance`). Keep legacy roles. Migrate users **gradually** when ready. No forced cutover.

**Option B:** Map each legacy role to a new role, reassign all users, deprecate old names. Higher risk; requires comms and a migration script.

**Review decision required:** See [05-review-checklist.md](05-review-checklist.md).

---

## Admin workflow (after implementation)

### Editing what a role can do

1. Go to **Settings → Role Management**.
2. Select a role (e.g. `finance`).
3. Filter by module (e.g. **Inbound**).
4. Check or uncheck permissions (e.g. `grn:invoice_collect`).
5. Save — changes apply on the user's next request (or re-login).

### Assigning roles to people

1. Go to **Settings → Users** (unchanged).
2. Create or edit a user.
3. Select one or more roles.
4. Save.

Effective access = **union** of all permissions from all assigned roles.

---

## Comparison: today vs proposed

| Topic | Today | Proposed |
|-------|-------|----------|
| Edit role permissions | Not possible in UI | Settings → Role Management |
| GRN invoice collected | Requires `admin` **role name** | Requires `grn:invoice_collect` **permission** |
| GRN audited / accounts approved | Requires `admin` role name | Requires `grn:audit`, `grn:accounts_approve` |
| Debit/credit accept/decline | Requires `admin` role name | Requires `debit_credit:decide` |
| Create/delete master listing | Requires full admin (`*:*`) | Requires `listings:create`, `listings:delete` |
| Sidebar modules | Visible to all authenticated users | Hidden when user lacks module permissions |
| Audit of permission changes | N/A | `role_permissions_updated` in activity log |

---

## Access matrix (proposed defaults — subject to sign-off)

Legend: ✓ = default grant · — = default deny · ⚠️ = open in checklist

| Capability | Inventory Mgmt | Finance | Ops Mgmt | QC | Admin |
|------------|:--------------:|:-------:|:--------:|:--:|:-----:|
| Listings read | ✓ | ✓ | ✓ | ✓ | ✓ |
| Listings write | — | — | — | — | ✓ |
| Bin ADD/REMOVE & outward | ✓ | — | ✓ | — | ✓ |
| Bins manage (create/delete) | ✓ | — | ✓ | — | ✓ |
| GRN inventory receipt | ✓ | — | ✓ | ⚠️ | ✓ |
| Outbound full flow | — | — | ✓ | — | ✓ |
| Collect invoice | — | ✓ | — | — | ✓ |
| Mark audited | — | ⚠️ | — | ⚠️ | ✓ |
| Approve accounts | — | ⚠️ | — | — | ✓ |
| Debit/credit decide | — | ⚠️ | — | — | ✓ |
| Role permission edit | — | — | — | — | ✓ |

---

*Next:* [Permission catalog](02-permission-catalog.md) · [Review checklist](05-review-checklist.md)
