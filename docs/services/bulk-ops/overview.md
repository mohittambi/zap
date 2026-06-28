# Bulk operations — overview

## Responsibility

**CSV import/export** for large batch updates without per-row UI:

- Secondary listings, AIS listings, packs/combos export
- Master SKU details export
- Imports: **master listings (create-only)**, secondary listings, AIS listings, packs/combos from uploaded buffers

**Service:** `bulkService.ts`.

## API

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/bulk/export/secondary-listings` | CSV download |
| GET | `/bulk/export/ais-listings` | CSV download |
| GET | `/bulk/export/packs-combos` | CSV download |
| GET | `/bulk/export/master-sku-details` | CSV download |
| POST | `/bulk/import/master-listings` | Bulk create master listings (CSV/XLSX; create-only) |
| POST | `/bulk/import/secondary-listings` | Upload CSV |
| POST | `/bulk/import/ais-listings` | Upload CSV |
| POST | `/bulk/import/packs-combos` | Upload CSV |

**Code:** `web/src/app/api/bulk/**`.

## Constraints

- File size and timeout limits are those of the hosting platform and Next.js route body limits.
- Validate data in staging before production imports.

## Master listings bulk import

**Permission:** `bulk:import` **and** `listings:write` (e.g. merchandising role).

**Behaviour:** Create-only. Each row becomes a new `listings` row with `source=zap` and a stub ID from `listings_stub_id_seq`. If `sku_id` already exists, that row is reported in `errors` and skipped.

**Required columns:** `sku_id`, `description`

**Optional columns:** `category`, `sku_type` (`SINGLE` | `PACK` | `COMBO`), `inventory_bypass_on` (`YES` | `NO`), `ops_tag`, `bulk_price`, `actual_weight`, `dimension`, `no_of_constituents`, `material_info`, `keyword_pool`, `img_hd`, `img_white`, `img_wdim`, `img_link1`, `img_link2`

**Sample file:** `web/public/samples/bulk/sample_master_listings_import.csv`

**Response:** `{ imported, errors: [{ row, message }], created_sku_ids }`
