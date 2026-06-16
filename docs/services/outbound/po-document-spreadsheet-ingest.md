# Original PO document spreadsheet ingest

**Audience:** Operations, outbound engineers  
**Related:** [PO listing commercial field repair](po-listing-commercial-field-repair.md), [EAN mappings import](ean-mappings-import.md)

---

## Summary

Vendor PO spreadsheets (Blinkit XLSX/CSV) uploaded under **Original PO documents** are parsed and applied to `listings_snapshot` **immediately on upload**. There is no separate preview step on the PO detail page.

All **17 vendor commercial columns** are stored in the snapshot and exported on the **SKU Level Report** (plus Zap enrichment columns).

Bulk **preview → apply** is used for **SKU / EAN Mappings** import (Settings → EAN Code Mappings), not for PO documents.

---

## Vendor column glossary

| Vendor header | Internal field | SKU report column |
|---------------|----------------|-------------------|
| Item Code | `po_secondary_sku` | `po_secondary_sku` |
| HSN Code | `hsn_code` | `hsn` |
| Product UPC | `product_upc` | `product_upc` |
| Product Description | `title` | `title` |
| Grammage | `grammage` | `grammage` |
| Basic Cost Price | `rate_without_tax` | `rate_without_tax` |
| CGST % | `cgst_percent` | `cgst_percent` |
| SGST % | `sgst_percent` | `sgst_percent` |
| IGST % | `igst_percent` | `igst_percent` |
| CESS % | `cess_percent` | `cess_percent` |
| Additional CESS | `additional_cess` | `additional_cess` |
| Tax Amount | `tax_amount` | `tax_amount` |
| Landing Rate | `landing_rate` | `landing_rate` |
| Quantity | `demand` / `original_demand` | `demand` |
| MRP | `mrp` | `mrp` (with labels resolution when needed) |
| Margin % | `margin` | `margin` |
| Total Amount | `total_amount` | `total_amount` |

**Effective GST %:** After parse, `tax_rate` is derived from split columns — IGST when &gt; 0, else CGST + SGST, else legacy single GST column, **plus CESS %** when present. IGST and CGST/SGST are not summed together (standard GST).

**Tax Amount:** Per unit on **Basic Cost Price**: `rate_without_tax × effective_tax_rate / 100`, plus **Additional CESS** as a per-unit rupee add-on when the vendor column is non-zero. MRP is not used in tax calculation.

Parser: [`outboundPoListingSpreadsheetParse.ts`](../../src/server/utils/outboundPoListingSpreadsheetParse.ts) · shared helpers: [`outboundListingNormalize.ts`](../../src/server/utils/outboundListingNormalize.ts) (`deriveEffectiveTaxRate`, `computeOutboundTaxAmountPerUnit`)

---

## UI flow

1. Upload spreadsheet via **Add PO document** (or during PO create).
2. Server stores the file in `outbound_po_attachments` and runs `applySpreadsheetToOutboundPo`.
3. Toast shows row count and any `parseWarning` for misaligned columns.
4. `analytics_object.listings_source_filename` records the applied file.

**Prefer vendor XLSX** over the sample CSV on live POs — uploading the sample replaces all line items with 2 rows.

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/outbound/purchase-orders/[id]/attachments` | Store file; spreadsheets auto-apply to line items |

Legacy routes (`/attachments/preview`, `/attachments/apply`, `/attachments/[id]/reparse`) remain for scripts but are not used in the PO UI.

Implementation: [`outboundPoSpreadsheetIngestService.ts`](../../src/server/services/outboundPoSpreadsheetIngestService.ts)

---

## Operations: PO 1735810041652

If line items show 2 rows or MRP `150` instead of `1099` for SKU `10314301`:

1. Re-upload the vendor XLSX `1735810041652 (1).xlsx` via **Add PO document**, or
2. Run the repair script:

```bash
cd web
npm run repair:outbound-po-listings -- --po-number 1735810041652 --reparse-from-source
```

---

## Tests

- [`outbound-po-document-spreadsheet.test.ts`](../../tests/unit/outbound-po-document-spreadsheet.test.ts)
