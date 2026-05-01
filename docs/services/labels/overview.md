# Labels — overview

## Responsibility

- **`labels_master_data`** — EAN, size, color, material, MRP, “one set contains”, etc. (`labelsService.ts`).
- **Product label PDFs** — fixed-layout rotated labels via `labelPdfService.ts` (`pdf-lib` + `bwip-js`): EAN-13 or Code128 barcodes, no QR in current layout.
- **Phase 1 box labels** — simple multi-line PDF per box range (outbound workflow).
- **Upload** — `POST /api/labels/upload` ingests spreadsheet rows into master data (see route).

## Dependencies

| Internal | External |
|----------|----------|
| `outbound_consignment_items`, `listings_snapshot` | — |

## See also

- [api.md](api.md)
