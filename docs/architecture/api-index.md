# API index

Base URL: **`/api`** (same origin as the Next.js app, or `NEXT_PUBLIC_API_URL` if set).

**Auth:** Almost all routes require `Authorization: Bearer <jwt>` or `X-API-Key: <key>`. Exceptions: `POST /api/auth/login`.

This index lists **96** Route Handlers under `web/src/app/api/`. For request/response bodies, see the handler source or the linked service doc.

## Auth

| Methods | Path | Notes |
|---------|------|--------|
| POST | `/auth/login` | Body: `email`, `password` → JWT + user |
| GET | `/auth/me` | Current user + permissions |
| POST | `/auth/refresh-api-key` | Regenerate API key (restricted) |

## Admin (`*:*` / admin role only)

| Methods | Path | Notes |
|---------|------|--------|
| GET | `/admin/roles` | List RBAC roles for pickers |
| GET, POST | `/admin/users` | List users / create (`email`, `password`, `roles[]`) |
| PATCH | `/admin/users/[id]` | `is_active`, `roles`, optional `password` |

## Bins

| Methods | Path |
|---------|------|
| GET | `/bins` |
| GET, PATCH | `/bins/[id]` |

## Bulk import / export

| Methods | Path |
|---------|------|
| GET | `/bulk/export/packs-combos` |
| GET | `/bulk/export/secondary-listings` |
| GET | `/bulk/export/ais-listings` |
| GET | `/bulk/export/master-sku-details` |
| POST | `/bulk/import/secondary-listings` |
| POST | `/bulk/import/ais-listings` |
| POST | `/bulk/import/packs-combos` |

## Catalogues

| Methods | Path |
|---------|------|
| GET | `/catalogue-templates` |
| GET, POST | `/catalogues` |
| GET, PATCH, DELETE | `/catalogues/[id]` |
| GET, POST, DELETE | `/catalogues/[id]/items` |
| POST | `/catalogues/[id]/items/bulk-import` |
| POST | `/catalogues/[id]/export/xlsx` |
| POST | `/catalogues/[id]/export/pdf` |

## Company–SKU

| Methods | Path |
|---------|------|
| GET | `/company-sku-relations` |

## Focus lists

| Methods | Path |
|---------|------|
| GET, POST | `/focus-lists` |
| GET, PATCH, DELETE | `/focus-lists/[id]` |
| GET, POST, DELETE | `/focus-lists/[id]/items` |

## Forms

| Methods | Path |
|---------|------|
| GET | `/forms/categories` |
| GET | `/forms/categories/[category]` |
| GET | `/forms/categories/[category]/[sub_category]` |
| GET | `/forms/response/[id]` |
| GET | `/forms/today/[id]/[userId]` |

## Incoming purchase orders (listing lines)

| Methods | Path |
|---------|------|
| GET | `/incoming_purchase_orders/listing_order_details/[sku_id]` |

## Inbound

| Methods | Path |
|---------|------|
| POST, GET | `/inbound/grns` |
| GET, PATCH | `/inbound/grns/[grnId]` |
| GET | `/inbound/grns/[grnId]/details` |
| GET | `/inbound/grns/[grnId]/files/[fileId]` |
| POST | `/inbound/grns/[grnId]/upload-zap` |
| GET | `/inbound/lot-listings` |
| GET | `/inbound/purchase-orders` |
| GET, POST | `/inbound/vendor-purchase-orders` |
| GET | `/inbound/vendor-purchase-orders/export` |
| GET | `/inbound/pending-audits/grns` |
| GET | `/inbound/pending-invoice-collection/grns` |
| GET | `/inbound/pending-debit-credit/notes` |
| GET | `/inbound/skus/[skuId]/inbound-summary` |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/details` |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/document` |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/grn-report` |
| PATCH | `/inbound/vendors/[id]/purchase-orders/[poId]/modify` |
| PATCH | `/inbound/vendors/[id]/purchase-orders/[poId]/cancel` |

## Inventory (secondary listings)

| Methods | Path |
|---------|------|
| GET | `/inventory/secondary_listings/paginated` |
| PATCH | `/inventory/secondary_listings/labels` |
| POST, PATCH, DELETE | `/inventory/secondary_listings/companies` |
| GET | `/inventory/secondary_listings/companies/list` |
| PATCH, DELETE | `/inventory/secondary_listings/companies/[id]` |
| GET | `/inventory/secondary_listings/sku_wise_details` |
| GET | `/inventory/secondary_listings/packs_and_combos/paginated` |

## Labels

| Methods | Path |
|---------|------|
| POST | `/labels/generate` |
| POST | `/labels/upload` |
| GET | `/labels-master` |

## Listings

| Methods | Path |
|---------|------|
| GET | `/listings/by_page_v4` |
| GET | `/listings/sku/names` |
| GET, PATCH | `/listings/sku/[sku_id]` |
| GET | `/listings/sku/[sku_id]/outbound-summary` |
| GET | `/listings/analytics/sku/[sku_id]` |
| GET | `/listings/incoming-quantity/[sku_id]` |
| GET | `/listings/inbound_summary/[sku_id]` |

## Outbound

| Methods | Path |
|---------|------|
| GET | `/outbound/companies` |
| GET | `/outbound/form-options` |
| GET | `/outbound/consignments` |
| GET | `/outbound/consignments/filters` |
| GET | `/outbound/consignments/[id]` |
| GET, POST | `/outbound/purchase-orders` |
| GET | `/outbound/purchase-orders/filter-options` |
| DELETE | `/outbound/purchase-orders/[id]` |
| GET | `/outbound/purchase-orders/[id]/detail` |
| GET | `/outbound/purchase-orders/[id]/items` |
| GET | `/outbound/purchase-orders/[id]/logs` |
| POST | `/outbound/purchase-orders/[id]/attachments` |
| GET | `/outbound/purchase-orders/[id]/attachments/[attachmentId]` |
| GET, POST | `/outbound/purchase-orders/[id]/consignments` |
| POST | `/outbound/purchase-orders/[id]/eautomate-actions` |
| GET | `/outbound/purchase-orders/[id]/eautomate-files/[fileId]` |
| POST | `/outbound/purchase-orders/[id]/files-zap` |

## Packs / combos

| Methods | Path |
|---------|------|
| GET | `/packs_combos/sku/[sku_id]` |

## Vendors

| Methods | Path |
|---------|------|
| POST | `/vendors` |
| GET | `/vendors/all` |
| GET, PATCH, DELETE | `/vendors/[id]` |
| POST | `/vendors/[id]/listings` |
| DELETE | `/vendors/[id]/listings/[skuId]` |
| GET | `/vendors/listings/[vendor_id]` |
| GET | `/vendors/sku/[sku_id]` |

## Warehouses & warehouse dump

| Methods | Path |
|---------|------|
| GET | `/warehouses` |
| GET | `/warehouses/[id]` |
| GET | `/warehouse_inventory_dump/sku_id/by_page/[sku_id]` |

---

## Count

**92** `route.ts` files = **92** API endpoints (some files export multiple HTTP methods).

## Maintenance

When adding a route:

1. Implement `web/src/app/api/.../route.ts`.
2. Add a row to this file (keep sections alphabetical within area).
3. Add or update the relevant `web/docs/services/<domain>/api.md` section.
