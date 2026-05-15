# Listings — API

Routes under `/api/listings` and related inventory endpoints for secondary views.

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/listings/by_page_v4` | Paginated listing grid (`search_keyword`, `page`, `count`) |
| GET | `/listings/sku/names` | Lightweight SKU name list |
| GET, PATCH | `/listings/sku/[sku_id]` | Detail + update |
| GET | `/listings/sku/[sku_id]/outbound-summary` | Aggregated outbound PO lines |
| GET | `/listings/analytics/sku/[sku_id]` | `sku_analytics` latest |
| GET | `/listings/incoming-quantity/[sku_id]` | Incoming quantity cache |
| GET | `/listings/inbound_summary/[sku_id]` | Inbound summary cache |
| GET | `/incoming_purchase_orders/listing_order_details/[sku_id]` | PO lines for SKU |

**Secondary / inventory (often used with listings UI):**

| Methods | Path |
|---------|------|
| GET | `/inventory/secondary_listings/paginated` |
| GET | `/inventory/secondary_listings/sku_wise_details` |
| GET | `/inventory/secondary_listings/packs_and_combos/paginated` |
| PATCH | `/inventory/secondary_listings/labels` |
| POST/PATCH/DELETE | `/inventory/secondary_listings/companies` |

**Implementation:** `web/src/app/api/listings/**`, `web/src/app/api/inventory/**`, `web/src/app/api/incoming_purchase_orders/**`.
