# Outbound — Pendency PDF

**Action:** `download_pendency_pdf` on `POST /api/outbound/purchase-orders/[id]/eautomate-actions`  
**Code:** [`outboundPoPendencyPdf.ts`](../../../src/server/utils/outboundPoPendencyPdf.ts) · route handler in [`eautomate-actions/route.ts`](../../../src/app/api/outbound/purchase-orders/[id]/eautomate-actions/route.ts)

Operators download a landscape PDF listing **open (pending) line items** for a channel PO — typically before or during fulfilment. Generation uses Zap Postgres only (no live eAutomate call).

---

## How to download

1. Open **Outbound → Purchase Orders → PO detail**.
2. Use the action that triggers **`download_pendency_pdf`** (same menu as SKU report / labels).
3. Browser receives `pendency-{po_number}.pdf`.

**Data source:** rows from the PO **`listings_snapshot`** (same envelope as the PO line-items grid). If the snapshot is empty, the PDF has no body rows.

---

## PDF layout

**Title:** `{company_name} Pendency` (defaults to `Blinkit` when company name is missing)  
**Subtitle:** `PO: {po_number}   Delivery: {delivery_location}`

| # | Column | Meaning |
|---|--------|---------|
| 1 | **#** | Row index (1-based) |
| 2 | **PO SKU** | Channel / marketplace item code on the PO line (`po_secondary_sku`) |
| 3 | **Company Code Primary** | Internal or mapped product identifier — **not** a repeat of PO SKU (see resolution below) |
| 4 | **Warehouse Inventory** | Sum of Zap **`bins.available_quantity`** for resolved SKU keys |
| 5 | **M.R.P** | `mrp` on the line |
| 6 | **Pending** | `pending` if set, else `demand - packed - dispatched` |

**Pagination:** Single page today; rows stop when vertical space runs out (~35 lines). Multi-page PDF is not implemented.

---

## Company Code Primary — resolution order

First non-empty value wins. **`po_secondary_sku` is never used** for this column (it already appears under **PO SKU**).

| Step | Source |
|------|--------|
| 1 | `company_code_primary` on the line, **only if** it differs from `po_secondary_sku` |
| 2 | `company_secondary_sku` (DB: `company_id` + `po_secondary_sku`) |
| 3 | `secondary_sku_company_details[]` entry for the PO’s company |
| 4 | **`master_sku`** (product SKU, e.g. `AAC500`) — line → nested `listing` → **`listings`** table, or **`company_ean_mappings.sku_code`** keyed by PO SKU (`zap_ean`) |
| 5 | `inventory_sku_id` — same sources as step 4, only if `master_sku` is missing |
| 6 | Blank |

**EAN barcodes are not shown** in this column — only internal product SKU. When the PO line has only a channel item code (`10149918`), Zap looks up **`company_ean_mappings`** for that company: `zap_ean` = PO SKU → `sku_code` = `AAC500`. Maintain mappings on **Outbound → SKU / EAN Mappings** (`/outbound/ean-mappings`).

**Typical Blinkit row:** PO SKU `10149918` → Company Code Primary `AAC500` when `listings.master_sku` (or the line snapshot) maps that channel code to the warehouse master SKU.

---

## Warehouse Inventory — resolution

Stock is **Zap bin stock only** (not eAutomate `listing.available_quantity`).

Before querying `bins`, **`loadOutboundSkuLookups`** (via `loadPendencyLookups`) batch-loads:

- `company_secondary_sku`, `company_ean_mappings` (PO SKU → `sku_code`), `listings`
- Seeds **`listingSkuByKey`** from EAN rows so channel codes resolve to product SKU even when `listings` has no row for the PO code
- Collects bin SKU ids from each line (including EAN `sku_code`), then `SUM(bins.available_quantity)` grouped by `sku_id`

**SKU keys tried** (first match with a bin row wins):

1. `inventory_sku_id` (line, listing, or `listings` DB)
2. `master_sku` (line, listing, `listings` DB, or **`company_ean_mappings.sku_code`**)
3. `po_secondary_sku`

| Bin query result | PDF cell |
|------------------|----------|
| Row exists, qty &gt; 0 | Integer total |
| Row exists, qty = 0 | `0` |
| No row for any candidate | *(blank)* |

---

## Example rows

| # | PO SKU | Company Code Primary | Warehouse Inventory | M.R.P | Pending |
|---|--------|----------------------|---------------------|-------|---------|
| 1 | `10149918` | `AAC500` | `42` | `1299` | `150` |
| 2 | `10149863` | `AAC501` | `0` | `2999` | `80` |
| 3 | `10146916` | *(blank — no listing/mapping)* | *(blank)* | `999` | `16` |

---

## Internal row shape (`PendencyRow`)

Built by `buildPendencyRowsFromListings` before `createOutboundPoPendencyPdf`:

```json
{
  "po_secondary_sku": "10149918",
  "company_code_primary": "AAC500",
  "warehouse_quantity": 42,
  "mrp": 1299,
  "pending": 150
}
```

---

## Related: SKU Level Report

| | **Pendency PDF** | **SKU Level Report** (`download_sku_report`) |
|---|------------------|-----------------------------------------------|
| Format | PDF | CSV |
| Focus | Pending qty + warehouse stock + MRP for open lines | Full commercial / GST columns for consignment or snapshot lines |
| SKU enrichment | `loadOutboundSkuLookups` + `enrichOutboundReportRow` | Same helpers via `buildSkuReportCsvFromRows` |
| Warehouse column | **Warehouse Inventory** (bins) | **`warehouse_quantity`** (bins) |
| Company / master SKU | **Company Code Primary** (this doc) | **`master_sku`**, **`company_code_primary`**, **`zap_ean`** — see [`outboundPurchaseOrdersService.ts`](../../../src/server/services/outboundPurchaseOrdersService.ts) |

---

## Tests

```bash
cd web && npx tsx --test tests/unit/outbound-po-pendency-pdf.test.ts tests/unit/outbound-po-sku-report.test.ts tests/unit/ean-mappings.test.ts
```

---

## See also

- [workflows.md](workflows.md) — `eautomate-actions` overview  
- [outbound-tab-process-notes.md](outbound-tab-process-notes.md) — operator checklist  
- [../../business/modules/outbound.md](../../business/modules/outbound.md) — business language for pendency reports
