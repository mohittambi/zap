# Catalogues — overview

## Responsibility

Manage **standard** and **custom** catalogues: CRUD on `catalogues`, manage `catalogue_items` (SKU membership, MOQ, display price, sort order), **bulk import** from spreadsheet, **export** to XLSX and themed PDF.

**Services:** `cataloguesService.ts`, `catalogueExportService.ts` (PDF/XLSX builders).

## Data model

- `catalogues` — `catalogue_type` ∈ `standard` | `custom`
- `catalogue_items` — FK to `listings(sku_id)`

## Dependencies

- Theme/template JSON: `web/src/data/catalogue-themes.json`
- Listings grid for builder: `GET /api/listings/by_page_v4`

## See also

- [api.md](api.md)
