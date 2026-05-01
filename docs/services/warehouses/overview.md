# Warehouses — overview

## Responsibility

Read-only **warehouse directory** and single-warehouse fetch for master data UIs.

**Service:** `warehousesService.ts`.

## Data model

Table `warehouses` (`001`): `id`, `name`, timestamps.

## API

| Methods | Path |
|---------|------|
| GET | `/warehouses` |
| GET | `/warehouses/[id]` |

**Code:** `web/src/app/api/warehouses/**`.
