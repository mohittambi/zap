# Vendors — API

| Methods | Path | Description |
|---------|------|-------------|
| POST | `/vendors` | Create vendor |
| GET | `/vendors/all` | All vendors |
| GET, PATCH, DELETE | `/vendors/[id]` | CRUD |
| POST | `/vendors/[id]/listings` | Link SKU to vendor |
| DELETE | `/vendors/[id]/listings/[skuId]` | Remove link |
| GET | `/vendors/listings/[vendor_id]` | Listings for vendor |
| GET | `/vendors/sku/[sku_id]` | Vendors carrying SKU |

**Code:** `web/src/app/api/vendors/**`.
