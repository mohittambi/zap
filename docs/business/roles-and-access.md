# Roles and Access

**Audience:** Managers, IT administrators, HR, Compliance  
**Plain-language guide to:** Who can see and do what in Zap

---

## Why role-based access matters

Zap uses a **Role-Based Access Control (RBAC)** system. This means:

- Every user is assigned one or more **roles**
- Each role grants access to specific features and data
- Users only see what they need to do their job
- Sensitive actions (e.g. cancelling orders, editing pricing) require elevated roles

This protects business data, prevents accidental changes, and ensures accountability — every action in Zap is tied to a specific named user.

---

## How it works — in plain English

Think of it like an office building:
- A **warehouse worker** has a key card that opens the warehouse and break room — but not the finance department.
- A **finance manager** can access accounting records — but not the warehouse management console.
- An **administrator** has a master key — full access to everything.

In Zap, roles work the same way.

---

## Standard roles and what they can do

Zap stores roles in the database using these names (shown in **Settings → Users**):

| DB role name | Business name |
| ------------ | ------------- |
| `admin` | Administrator |
| `ops_manager` | Operations Manager |
| `warehouse_staff` | Warehouse Staff |
| `finance` | Finance / Accounts |
| `merchandising` | Merchandising / Category |
| `sales` | Sales / Key Accounts |

### Administrator
**Who this is for:** IT leads, senior operations managers  
**What they can do:**
- Full access to all modules and all data
- Create, edit, and deactivate user accounts
- Assign and change roles
- Access all system settings and audit logs
- Trigger data syncs with eAutomate
- **Mark inbound GRNs as audited** (close the pending-audit workflow) — only administrators can complete this step

### Inbound audit controls

Completing the **Pending Audit** step (marking a GRN as audited) is restricted to users with the **Administrator** role:

- The web UI shows a **Confirm Audit** dialog before the action is sent to the server.
- Non-administrators see a disabled **Mark Audited** button; direct API attempts return an error and are logged.
- After audit is complete, GRN receipt line data is **locked** and cannot be edited.
- Price discrepancies can trigger automatic debit-note generation; all audit actions are recorded in the GRN activity log.

Other roles (warehouse, finance, operations) may still enter quantities and upload invoices while a GRN is open, but **cannot bypass audit approval**.

---

### Operations Manager
**DB role:** `ops_manager`
**Who this is for:** Ops leads, logistics managers
**What they can do:**
- View and manage all inbound and outbound POs
- Acknowledge, update, and cancel outbound orders
- Generate and download labels and reports
- Manage consignments and dispatch records
- View vendor and warehouse data
- Create/delete bin locations (`bins:manage`)
- Submit operational forms (`forms:write`)
- Use dashboard query builder (`query_builder:read`)
- Delete vendors when required (`vendors:delete`)

**They cannot:**
- Create or deactivate user accounts
- Change pricing or SKU financial data

---

### Warehouse Staff
**DB role:** `warehouse_staff`
**Who this is for:** Warehouse workers, GRN raisers, dispatch team
**What they can do:**
- Raise and edit GRNs for inbound deliveries
- View inbound POs assigned to their warehouse
- Look up and manage bin locations for products (`bins:manage`)
- Submit operational forms (`forms:write`)
- View outbound POs to guide picking
- Use the Zap Ops mobile app

**They cannot:**
- Edit product listings or pricing
- Acknowledge or cancel channel orders
- Access financial notes or settlement records
- Mark GRNs as audited (admin-only)

---

### Finance / Accounts
**DB role:** `finance`
**Who this is for:** Finance managers, accounts payable/receivable
**What they can do:**
- View all GRNs and their linked invoices
- Raise and manage debit and credit notes
- Download financial reports and statements
- View vendor and product records for reference
- Submit operational forms (`forms:write`)
- Use dashboard query builder (`query_builder:read`)

**They cannot:**
- Edit product listings
- Acknowledge or cancel orders
- Generate labels
- Mark GRNs as audited (admin-only)

---

### Merchandising / Category
**DB role:** `merchandising`
**Who this is for:** Category managers, buyers, product team  
**What they can do:**
- View and edit product listings (name, images, dimensions, pricing, category)
- Create and manage catalogues
- Export product data
- Manage focus lists
- Use bulk import/export for product data

**They cannot:**
- Access GRN or financial records
- Acknowledge or cancel orders
- Manage user accounts

---

### Sales / Key Accounts
**DB role:** `sales`
**Who this is for:** Sales managers, account managers, KAMs
**What they can do:**
- View product listings and stock levels
- Build and export catalogues
- View outbound PO status for their accounts
- Manage their own focus lists
- Use dashboard query builder (`query_builder:read`)

**They cannot:**
- Edit product data
- Generate labels
- Access GRN or financial records
- Manage orders directly

---

### Read-Only Viewer
**Who this is for:** Auditors, senior stakeholders, temporary access  
**What they can do:**
- View (but not edit) all modules they are granted access to
- Download reports

**They cannot:**
- Create, edit, or delete any record
- Perform any action (acknowledge, generate, cancel, etc.)

---

## Access matrix summary

| Action | Admin | Ops Manager | Warehouse | Finance | Merchandising | Sales | Read-Only |
|--------|-------|-------------|-----------|---------|---------------|-------|-----------|
| View inbound POs | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Raise GRN | ✓ | ✓ | ✓ | — | — | — | — |
| Raise debit/credit note | ✓ | ✓ | — | ✓ | — | — | — |
| View outbound POs | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Acknowledge / cancel PO | ✓ | ✓ | — | — | — | — | — |
| Generate labels | ✓ | ✓ | ✓ | — | — | — | — |
| Download reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit product listings | ✓ | — | — | — | ✓ | — | — |
| Build catalogues | ✓ | — | — | — | ✓ | ✓ | — |
| Manage bin locations | ✓ | ✓ | ✓ | — | — | — | — |
| Manage vendors (delete) | ✓ | ✓ | — | — | — | — | — |
| Bulk import/export | ✓ | ✓ | — | — | ✓ | — | — |
| Manage users and roles | ✓ | — | — | — | — | — | — |

---

## Managing users (for administrators)

### Adding a new user
1. Go to **Settings → Users** (admin only).
2. Click **Add User**.
3. Enter email, temporary password, and assign one or more roles.
4. Save — share the password securely (Zap does not send email invitations yet).

### Changing a role
1. Go to **Settings → Users**.
2. Find the user.
3. Click **Edit** → change the role → Save.
4. Changes take effect immediately on next login.

### Deactivating a user
When someone leaves the company:
1. Go to **Settings → Users**.
2. Find the user and click **Deactivate**.
3. Their account is immediately locked — they can no longer log in.
4. All their historical actions remain in the audit log.

> Important: Always deactivate accounts promptly when someone leaves. Active accounts are a security risk.

---

## API access (for integrations and automations)

Some processes (e.g. automated syncs, ERP integrations) use **API keys** instead of user logins. API keys:
- Are created and managed by the administrator
- Are assigned specific permissions (not necessarily full admin access)
- Should be rotated regularly for security
- Must never be shared or committed to code repositories

Contact your IT administrator to request or manage API keys.

---

## Audit trail

Every action in Zap — creating a GRN, acknowledging an order, generating labels, editing a product — is logged with:
- The user's name
- The date and time
- What was changed

This log is available to administrators and is immutable — it cannot be edited or deleted. It is your full operational audit trail.

---

*Back to:* [Business Documentation Index](index.md)  
*Related:* [Getting Started](getting-started.md) | [Platform Overview](platform-overview.md)
