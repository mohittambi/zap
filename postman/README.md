# Zap API – Postman collection

## Import

1. Open Postman.
2. **Import** → **File** → select `Zap-API.postman_collection.json`.
3. The collection **Zap API** appears with all requests grouped.

## Auth

- **Option A (JWT):** Run **Auth → Login** (body uses `admin@example.com` / `admin123`). The test script saves the token; other requests use **Authorization: Bearer {{token}}**.
- **Option B (API key):** In the collection (or each request), change the auth header to **X-API-Key** with value `{{api_key}}` (default: `zap_seed_admin_key`).

## Variables

Set in the collection (Edit collection → Variables) or in a Postman environment:

| Variable     | Example / use |
|-------------|----------------|
| `base_url`  | `http://localhost:3000/api` |
| `token`     | Set automatically by Login test script |
| `api_key`   | `zap_seed_admin_key` (seed admin) |
| `sku_id`    | SKU for listing/vendor/analytics requests |
| `vendor_id` | Vendor ID for vendor requests |
| `warehouse_id` | Warehouse ID for warehouse/bin requests |
| `form_id`   | Form ID for form requests |
| `user_id`   | User ID for form response / today |

## Groups

- **Auth** – login, me, refresh API key  
- **Listings** – SKU names, detail, paginated, inbound summary, incoming quantity  
- **Analytics** – SKU analytics  
- **Packs & Combos** – pack/combo by SKU  
- **Warehouse Inventory** – warehouse inventory dump by SKU  
- **Purchase Orders** – listing order details by SKU  
- **Vendors** – all, by ID, listings, by SKU  
- **Inventory** – secondary listings (packs, paginated, SKU-wise details)  
- **Forms** – categories, sub-categories, form definition, response, today  
- **Warehouses** – list, by ID  
- **Bins** – list (with filters), by ID  

Ensure the API is running (`npm start`) before sending requests.
