# Labels — API

| Methods | Path | Description |
|---------|------|-------------|
| POST | `/labels/generate` | Build product label PDF from posted row payload + `labelSize` |
| POST | `/labels/upload` | Upload spreadsheet → upsert `labels_master_data` |
| GET | `/labels-master` | Paginated search over labels master |

**Related outbound workflow:** product label row data and phase-1 box labels may be triggered via `POST /api/outbound/purchase-orders/[id]/eautomate-actions` (see [../outbound/api.md](../outbound/api.md)).

**Code:** `web/src/app/api/labels/**`, `web/src/server/services/labelPdfService.ts`, `labelsService.ts`.
