# Data Collection Sheets — Filling Guide

These CSV files are business data templates. Share them with the relevant person to collect master data.
Each sheet has:
- **Row 1** — Column headers in plain English
- **Row 2** — Instructions / format hints for each column (shown in `[brackets]`)
- **Rows 3+** — Sample data rows showing what real entries look like

When filling the sheets, add your data below Row 2. Row 2 is a guide and should be removed before importing into the database.

---

## Who Fills What

### Owner / Business Team

These sheets contain master data that the business owner or category team maintains.

| File | Sheet Name | Purpose |
|------|-----------|---------|
| `01_warehouses.csv` | Warehouse List | Names and IDs of all physical warehouse locations |
| `02_listings.csv` | Product Catalog | Every product SKU with title, category, dimensions, price, images and material |
| `03_bins.csv` | Bin / Storage Locations | Which SKU is stored in which bin inside which warehouse, and how many units |
| `05_pack_combos.csv` | Bundle Definitions | Which individual products are bundled together to form a combo/gift set |
| `07_listing_order_details.csv` | Purchase Orders | All purchase orders placed with vendors — quantities, prices, delivery dates and status |
| `11_vendors.csv` | Vendor Directory | Full vendor list with address, GSTIN and contact details |
| `12_vendor_specialties.csv` | Vendor Specialties | What each vendor makes or supplies (Resin, Bamboo, Canvas etc.) |
| `13_vendor_sku.csv` | Vendor-Product Pricing | Which vendor supplies which SKU and at what cost price |

---

### Admin / IT Team

These sheets define who has access to the system and what they can do.

| File | Sheet Name | Purpose |
|------|-----------|---------|
| `14_users.csv` | System Users | Email addresses of all staff who need login access |
| `15_roles.csv` | Roles (Reference) | Predefined roles — do not change without consulting IT |
| `16_permissions.csv` | Permissions (Reference) | Predefined API permissions — do not change |
| `17_role_permissions.csv` | Role-Permission Map (Reference) | Which role gets which permissions — predefined |
| `18_user_roles.csv` | User Role Assignments | Assign each staff member to their role |

---

### Ops / Forms Team

These sheets are managed by the operations team.

| File | Sheet Name | Purpose |
|------|-----------|---------|
| `10_secondary_listings.csv` | Channel SKU Mappings | Maps internal SKUs to the SKU used on each sales channel (Amazon, Flipkart etc.) |
| `19_forms.csv` | Form Templates | Daily / weekly reporting forms used by warehouse and graphics teams |

---

### System Managed — Do Not Fill

These sheets are auto-populated by the application or synced from eautomate. They are included here for reference only.

| File | Sheet Name | Notes |
|------|-----------|-------|
| `04_sku_analytics.csv` | SKU Movement Analytics | Auto-synced from eautomate — inward/outward counts per SKU |
| `06_warehouse_inventory_dump.csv` | Inventory Movement Log | Auto-recorded by the warehouse app on every ADD/REMOVE operation |
| `08_inbound_summary.csv` | Inbound Summary | Auto-synced expected inbound quantities per SKU per date |
| `09_incoming_quantity.csv` | Incoming Quantity | Auto-synced total expected delivery qty per SKU |
| `20_form_submissions.csv` | Form Submissions | Auto-recorded when staff submit a form in the app |

---

## Column Name Reference (Friendly → Database)

For the technical team importing data, this table maps the sheet's plain-English headers back to the actual database column names.

### 02_listings.csv (Product Catalog → `listings` table)

| Sheet Column | DB Column |
|-------------|-----------|
| SKU Code | sku_id |
| Master SKU | master_sku |
| Inventory SKU | inventory_sku_id |
| Pack Combo SKU | pack_combo_sku_id |
| SKU Type | sku_type |
| Inventory Bypass | inventory_bypass_on |
| Ops Tag | ops_tag |
| Category | category |
| Product Title | description |
| Meta Tags | meta_fields |
| HD Image URL | img_hd |
| White BG URL | img_white |
| Dim Image URL | img_wdim |
| Alt Image 1 | img_link1 |
| Alt Image 2 | img_link2 |
| No. of Constituents | no_of_constituents |
| Weight (grams) | actual_weight |
| Dimensions | dimension |
| Bulk Price (INR) | bulk_price |
| Search Keywords | keyword_pool |
| Material | material_info |

### 07_listing_order_details.csv (Purchase Orders → `listing_order_details` table)

| Sheet Column | DB Column |
|-------------|-----------|
| PO Number | po_number |
| SKU Code | po_secondary_sku |
| Master SKU | master_sku |
| SKU Type | sku_type |
| Company Code | company_code_primary |
| Ordered Quantity | demand |
| HSN Code | hsn_code |
| Product Name | title |
| MRP (INR) | mrp |
| Rate excl. Tax (INR) | rate_without_tax |
| Tax Rate (%) | tax_rate |
| Size | size |
| Color | color |
| Created By | created_by |
| PO Issue Date | po_issue_date |
| Expiry Date | expiry_date |
| Dispatched Qty | dispatched_quantity |
| Packed Qty | packed_quantity |
| Supplier Name | company_name |
| Delivery City | delivery_city |
| PO Type | po_type |
| PO Status | calculated_po_status |

### 11_vendors.csv (Vendor Directory → `vendors` table)

| Sheet Column | DB Column |
|-------------|-----------|
| Vendor ID | id |
| Vendor Name | vendor_name |
| Address | vendor_address_line |
| City | vendor_city |
| State | vendor_state |
| PIN Code | vendor_postal_code |
| GSTIN | vendor_gstin |
| Contact Number | vendor_contact_number |

### 18_user_roles.csv (User Role Assignments → `user_roles` table)

| Sheet Column | Notes |
|-------------|-------|
| User Email | Resolved to `user_id` via `users.email` on import |
| Role Name | Resolved to `role_id` via `roles.name` on import |

---

## Importing into the Database

Run migrations first, then load the CSVs.

**Important:** Remove the hint row (Row 2) from each CSV before importing, or the import script will fail on that row.

```bash
# Run database migrations (001 through 020)
# Then import sample data:
npm run seed:sample

# Or manually:
bash scripts/load_sample_data.sh
```

Import must follow this order to satisfy foreign key constraints:

1. `01_warehouses.csv` → warehouses
2. `02_listings.csv` → listings
3. `03_bins.csv` → bins
4. `04_sku_analytics.csv` → sku_analytics
5. `05_pack_combos.csv` → pack_combos
6. `06_warehouse_inventory_dump.csv` → warehouse_inventory_dump
7. `07_listing_order_details.csv` → listing_order_details
8. `08_inbound_summary.csv` → inbound_summary
9. `09_incoming_quantity.csv` → incoming_quantity
10. `10_secondary_listings.csv` → secondary_listings
11. `11_vendors.csv` → vendors
12. `12_vendor_specialties.csv` → vendor_specialties
13. `13_vendor_sku.csv` → vendor_sku
14. `14_users.csv` → users (email only — run `npm run seed` after to add admin user with auth)
15. `15_roles.csv` → roles
16. `16_permissions.csv` → permissions
17. `17_role_permissions.csv` → role_permissions
18. `18_user_roles.csv` → user_roles (resolved from email/role name to IDs by import script)
19. `19_forms.csv` → forms
20. `20_form_submissions.csv` → form_submissions

## Notes

- `listing_embeddings` table is not included (contains VECTOR type, not CSV-friendly).
- If seeds were already run, some rows may conflict. Use `ON CONFLICT` or truncate before import.
- After importing users, run `npm run seed` to create the admin account with a hashed password.
