# Company–SKU relations — overview

## Responsibility

Link **companies** (channel buyers) to **secondary SKUs** for marketplace-specific codes and pricing context. Supports listing, association CRUD, and dropdown data for the UI.

**Service:** `companySkuService.ts`. Table: `company_secondary_sku` (includes `company_code_primary`, `updated_at` per migration `041`).

## API

| Methods | Path |
|---------|------|
| GET | `/company-sku-relations` |

**Code:** `web/src/app/api/company-sku-relations/route.ts`.

## See also

- [../../architecture/database-schema.md](../../architecture/database-schema.md) § Companies
