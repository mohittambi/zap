# Catalogues — API

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/catalogue-templates` | Template metadata for exports |
| GET, POST | `/catalogues` | List / create catalogue |
| GET, PATCH, DELETE | `/catalogues/[id]` | CRUD one catalogue |
| GET, POST, DELETE | `/catalogues/[id]/items` | List/add/remove items |
| POST | `/catalogues/[id]/items/bulk-import` | Spreadsheet import |
| POST | `/catalogues/[id]/export/xlsx` | Generate XLSX |
| POST | `/catalogues/[id]/export/pdf` | Generate PDF |

**Code:** `web/src/app/api/catalogues/**`, `web/src/app/api/catalogue-templates/route.ts`.
