# Inventory — API

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/inventory/secondary_listings/paginated` | Secondary listing grid |
| PATCH | `/inventory/secondary_listings/labels` | Update labels JSON on rows |
| POST, PATCH, DELETE | `/inventory/secondary_listings/companies` | Company association mutations |
| GET | `/inventory/secondary_listings/companies/list` | Companies list |
| PATCH, DELETE | `/inventory/secondary_listings/companies/[id]` | One association |
| GET | `/inventory/secondary_listings/sku_wise_details` | Merged SKU-wise payload |
| GET | `/inventory/secondary_listings/packs_and_combos/paginated` | Pack/combo listing |
| GET | `/packs_combos/sku/[sku_id]` | Components for parent SKU |
| GET | `/bins` | Bin list |
| GET, PATCH | `/bins/[id]` | Bin get/update |
| GET | `/warehouse_inventory_dump/sku_id/by_page/[sku_id]` | Paginated dump |

**Code:** `web/src/app/api/inventory/**`, `bins/**`, `packs_combos/**`, `warehouse_inventory_dump/**`.
