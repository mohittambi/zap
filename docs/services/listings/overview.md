# Listings & SKU catalog — overview

## Responsibility

- **Master catalog** — `listings` table: SKU identity, images, dimensions, pricing hints, links to bins and analytics.
- **Read APIs** — paginated grid (`by_page_v4`), SKU detail, names lookup, inbound/outbound summaries, analytics, incoming quantity.
- **Writes** — PATCH listing fields where permitted.

**Primary service:** `listingsService.ts`. Related: `analyticsService.ts`, `purchaseOrdersService.ts` (listing order lines), `inventoryService.ts` (secondary listings).

## Dependencies

| Internal | External |
|----------|----------|
| `bins`, `sku_analytics`, `listing_order_details` | eAutomate for sync-enriched fields on some screens |

## Edge cases

- **SKU id** is string `sku_id` — stable join key across bins, orders, and snapshots.
- **Secondary listings** are a separate table (`secondary_listings`) with enrichment JSONB — not identical to master `listings` rows.

## See also

- [api.md](api.md)
- [data-model.md](data-model.md)
- [../inventory/overview.md](../inventory/overview.md)
