# Bulk operations — overview

## Responsibility

**CSV import/export** for large batch updates without per-row UI:

- Secondary listings, AIS listings, packs/combos export
- Master SKU details export
- Imports: secondary listings, AIS listings, packs/combos from uploaded buffers

**Service:** `bulkService.ts`.

## API

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/bulk/export/secondary-listings` | CSV download |
| GET | `/bulk/export/ais-listings` | CSV download |
| GET | `/bulk/export/packs-combos` | CSV download |
| GET | `/bulk/export/master-sku-details` | CSV download |
| POST | `/bulk/import/secondary-listings` | Upload CSV |
| POST | `/bulk/import/ais-listings` | Upload CSV |
| POST | `/bulk/import/packs-combos` | Upload CSV |

**Code:** `web/src/app/api/bulk/**`.

## Constraints

- File size and timeout limits are those of the hosting platform and Next.js route body limits.
- Validate data in staging before production imports.
