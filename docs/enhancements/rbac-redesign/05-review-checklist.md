# Review Checklist

**Status:** DRAFT FOR REVIEW  
**Last updated:** 2026-07-02  
**Audience:** PM, module owners, IT lead  
**Related:** [Review pack hub](README.md) · [Business roles](01-business-roles-proposal.md)

---

## How to use this checklist

1. Each **owner** reviews the linked doc section and marks their row.
2. Use status: **Approved** · **Rejected** · **Needs change** · **Pending**
3. Add comments inline in the PR or in your team's tracker referencing section headings.
4. **Open questions** below must be resolved before implementation starts.

---

## Sign-off table

| # | Item | Owner | Doc reference | Status |
|---|------|-------|---------------|--------|
| 1 | Four proposed business roles (`inventory_management`, `finance`, `ops_management`, `qc`) | Ops lead | [01-business-roles-proposal.md](01-business-roles-proposal.md) | Pending |
| 2 | Legacy role strategy (keep + gradual migrate vs replace) | IT admin | [01 § Legacy roles](01-business-roles-proposal.md#legacy-roles-current-production) | Pending |
| 3 | Inventory Management warehouse bundle (confirmed list) | Warehouse lead | [01 § Inventory Management](01-business-roles-proposal.md#inventory-management) | Pending |
| 4 | Finance: collect invoice (`grn:invoice_collect`) | Finance lead | [02 § New permissions](02-permission-catalog.md#new-permissions-proposed--migration-required) | **Confirmed** |
| 5 | Finance: audit, accounts approve, debit/credit decide (defaults) | Finance lead | [01 § Finance](01-business-roles-proposal.md#finance) | Pending |
| 6 | QC inbound scope (GRN raise, close, quantities, receipt) | QC lead | [01 § QC](01-business-roles-proposal.md#qc) | Pending |
| 7 | Ops Management: outbound create/cancel; inbound access | Ops lead | [01 § Operation Management](01-business-roles-proposal.md#operation-management) | Pending |
| 8 | Listings defaults per role (read vs write/create/delete) | Merchandising | [02 § Listings matrix](02-permission-catalog.md#listings-fine-grained-matrix) | Pending |
| 9 | Role Management UI location and layout | Product | [03-role-management-ui.md](03-role-management-ui.md) | Pending |
| 10 | Nav hide-by-permission | Product | [03 § Navigation visibility](03-role-management-ui.md#navigation-visibility-recommended-v1) | Pending |
| 11 | Technical phasing and migration approach | Engineering lead | [04-technical-implementation.md](04-technical-implementation.md) | Pending |
| 12 | Activity log for role permission changes | Compliance / IT | [03 § Activity logging](03-role-management-ui.md#activity-logging-on-save) | **Confirmed** |

---

## Open questions

Resolve each with a decision recorded in the sign-off table or PR comments.

### Q1 — Finance elevated permissions (beyond invoice collect)

Should the `finance` role receive these **by default** at launch?

| Permission | Action |
|------------|--------|
| `grn:audit` | Complete Pending Audits |
| `grn:accounts_approve` | Approve/reject Pending Accounts |
| `debit_credit:decide` | Accept/decline Pending Debit & Credit |

- [ ] Yes — all three defaults on `finance`
- [ ] Partial — specify: _______________
- [ ] No — admin assigns manually via Role Management

### Q2 — QC inbound scope

What can QC users do on inbound?

| Action | Grant? |
|--------|--------|
| View inbound POs / GRNs | Proposed yes |
| Raise / edit GRN | ? |
| Enter accepted / rejected / shortage quantities | ? |
| Close GRN | ? |
| Mark audit complete | Proposed no |
| Book inventory into bins | Proposed no |
| Access finance queues | Proposed no |

### Q3 — Ops Management inbound

- [ ] Outbound + inventory only (no inbound modules)
- [ ] Read-only inbound (POs/GRNs view)
- [ ] Full inbound (same as ops_manager legacy)

### Q4 — Role Management scope

- [ ] Edit permissions on existing roles only (v1 recommendation)
- [ ] Also create / rename / delete roles

### Q5 — Mobile permission parity

- [ ] Required for v1 launch (InboundGrnActions gates)
- [ ] Web-only v1; mobile follows in v1.1

### Q6 — Bulk master listing import

Map `POST /api/bulk/import/master-listings` to:

- [ ] `listings:create` + `bulk:import` (both required)
- [ ] New `listings:import` permission
- [ ] Keep admin-only for bulk master import

### Q7 — Existing `finance` role name

The database already has a `finance` role. For the new Finance business role:

- [ ] Extend existing `finance` role permissions (recommended)
- [ ] Create new role name e.g. `finance_v2` and migrate users

---

## Confirmed decisions (do not re-open without exec approval)

| Decision | Source |
|----------|--------|
| Admin can add/remove permissions per role in UI | Stakeholder thread |
| Module-based permission editor with search/select | Stakeholder thread |
| Fine-grained listings permissions | Stakeholder thread |
| Inventory Management: scan-update, outward, GRN receipt, bins:manage, warehouses, bin changes | Stakeholder thread |
| Finance: collect invoices via assignable permission | Stakeholder thread |
| Admin-only gates become attachable permissions (defaults on admin) | Stakeholder thread |
| Role/permission changes in activity log | Stakeholder thread |

---

## Review instructions

### For business reviewers

Read [01-business-roles-proposal.md](01-business-roles-proposal.md) and answer Q1–Q3. Focus on access matrix and "cannot do" lists.

### For IT / admins

Read [02-permission-catalog.md](02-permission-catalog.md) and [03-role-management-ui.md](03-role-management-ui.md). Confirm permission names and UI workflow match how you assign access today.

### For engineering

Read [04-technical-implementation.md](04-technical-implementation.md). Comment on phasing, risks, and test plan.

### After approval

1. Mark this checklist rows **Approved**.
2. Create implementation tickets from Phase 1–4 in doc 04.
3. Update [README.md](README.md) status from DRAFT to APPROVED.
4. Post-implementation: update [roles-and-access.md](../../business/roles-and-access.md) for GA documentation.

---

## Comment template

Copy into PR review:

```
## RBAC review — [Your name] — [Role]

**Sign-off:** [Approved / Needs change / Rejected]

**Q1 Finance elevated:** [answer]
**Q2 QC scope:** [answer]
**Q3 Ops inbound:** [answer]

**Notes:**
- 
```

---

*Back to:* [Review pack hub](README.md)
