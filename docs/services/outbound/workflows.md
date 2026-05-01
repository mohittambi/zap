# Outbound logistics — workflows

## PO lifecycle (typical)

1. **List** — `GET /api/outbound/purchase-orders` with filters (search, WIP, company, delivery location, etc.).
2. **Detail** — `GET .../detail` loads PO + sync metadata + listings snapshot + related data for UI.
3. **WIP** — operators mark work-in-progress; `is_wip` drives filters and partial-PO flows.
4. **Consignments** — rows synced from eAutomate `consignments/all/paginated` into `outbound_consignments`; optional **detail** payload in `detail_raw` (`043`).
5. **Attachments** — upload to Zap Storage (`files-zap`); original eAutomate files via `eautomate-files/[fileId]`.

## Consignments + directory sync (eAutomate)

**Companies:** `GET /public/api/companies` → upsert `companies`.

**Delivery locations:** `GET /public/api/incoming_purchase_orders/delivery_locations` → `outbound_consignment_delivery_locations`.

**Consignments:** `POST /public/api/incoming_purchase_orders/consignments/all/paginated` with JSON body filters (`poNumber`, `invoiceNumber`, `companyIds`, `deliveryLocations`, `rtdDates`). Pagination: repeat `page` until a page returns fewer than `count` rows or zero rows.

**Scripts:** `npm run` scripts `sync:outbound-companies`, `sync:outbound-consignments`, `sync:outbound-consignment-items` (see [../../operations/sync-runbook.md](../../operations/sync-runbook.md)).

## Local workflow actions (`eautomate-actions`)

`POST /api/outbound/purchase-orders/[id]/eautomate-actions` with JSON `{ action: ... }`:

- **acknowledge / cancel** — update statuses in Postgres.
- **download_sku_report / download_pendency_pdf** — generate CSV/PDF from DB snapshots/items.
- **generate_product_labels** — returns row data for the label wizard; PDF via `/api/labels/generate`.
- **generate_phase1_box_labels** — PDF box labels from range + PO header fields.

Upstream eAutomate is **not** called for these paths when running in “local” mode (reference system only).

## See also

- [overview.md](overview.md)
- [../eautomate-integration/sync-flows.md](../eautomate-integration/sync-flows.md)
