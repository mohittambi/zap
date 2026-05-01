# Current system — overview

## What Zap is

**Zap** is an internal operations platform for **product listings, inventory, vendors, warehouses, catalogues, labels, forms, and inbound/outbound logistics**. It is implemented as a **Next.js** web application with a **PostgreSQL** database and **RBAC-protected** HTTP APIs under `/api`.

**eAutomate** is the upstream reference ERP: Zap can **sync** data from eAutomate into Postgres and, where configured, proxy or mirror reads. Zap-specific workflow actions (acknowledge/cancel PO, local PDF/CSV generation, Zap Storage uploads) are implemented **in Zap** so operations do not depend on fragile upstream HTTP behavior.

## Who uses it

- **Operations / logistics** — inbound GRNs, outbound POs, consignments, labels.
- **Merchandising / catalog** — listings, secondary listings, catalogues, focus lists.
- **Integrations** — mobile (Zap Ops) and scripts call the same APIs with JWT or API keys.

## Major modules (as implemented)

| Area | UI entry (typical) | Backend |
|------|-------------------|---------|
| Listings & SKU detail | `/listings`, `/listings/[skuId]` | `listingsService`, `inventoryService` |
| Secondary listings / inventory | `/listings/secondary`, `/inventory/*` | `inventoryService`, `listingsService` |
| Vendors | `/vendors`, inbound vendor routes | `vendorsService`, `vendorPurchaseOrdersService` |
| Warehouses & bins | `/warehouses`, `/bins` | `warehousesService`, `binsService` |
| Inbound | `/inbound/*` | `inboundGrnsService`, `eautomateGrnDetailsIngestService`, etc. |
| Outbound | `/outbound/*` | `outboundPurchaseOrdersService`, `outboundConsignmentsService` |
| Catalogues | `/catalogues` | `cataloguesService`, `catalogueExportService` |
| Labels | `/listings/labels-master`, logistics labels | `labelsService`, `labelPdfService` |
| Forms | `/forms/*` | `formsService` |
| Focus lists | `/listings/focus` | `focusListsService` |
| Company–SKU | `/listings/company-sku` | `companySkuService` |
| Bulk CSV/XLSX | API + bulk pages | `bulkService` |

## Technical summary

- **Stack:** Next.js 16 (App Router), React 19, Postgres (`pg`), JWT + API key auth, RBAC.
- **Schema:** 44 ordered SQL migrations under `web/migrations/`.
- **API surface:** 92 route handlers — see [../architecture/api-index.md](../architecture/api-index.md).
- **Mobile:** `mobile/` React Native client (Zap Ops).

## Relationship to older docs

This document supersedes the narrative portions of **`project-features-modules.md`** for “what exists today.” For stakeholder-friendly feature tables, that file may still be useful; prefer this tree for **engineering accuracy**.

## See also

- [workflows.md](workflows.md) — end-to-end flows
- [limitations.md](limitations.md) — constraints and known gaps
- [../architecture/hld.md](../architecture/hld.md) — high-level design
