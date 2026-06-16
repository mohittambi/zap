# EAN mappings CSV import / export

**Audience:** Admins, outbound engineers  
**Related:** [PO listing commercial field repair](po-listing-commercial-field-repair.md)

---

## Summary

Admins can export all mappings to CSV and import updates with a **preview → apply** dialog on **Settings → EAN Code Mappings**.

Import runs a preview step that classifies each row; **replacement** and **warning** rows require explicit checkbox approval before apply.

EAN mappings resolve **PO secondary SKU → master SKU / EAN**. They do **not** set MRP; retail MRP comes from the PO spreadsheet or `labels_master_data` (see MRP resolution in the repair doc).

---

## CSV format

Sample file: [`public/samples/ean-mappings/sample_ean_mappings_import.csv`](../../public/samples/ean-mappings/sample_ean_mappings_import.csv)

Required columns (header names are flexible aliases):

- Company code or company id
- PO secondary SKU (Blinkit item code)
- Master SKU and/or EAN

---

## Import row statuses

| Status | Meaning |
|--------|---------|
| `new` | New mapping — will insert |
| `replace` | Existing mapping — will update (requires confirmation) |
| `unchanged` | No change |
| `warning` | Applied with caveats (e.g. duplicate key in file) |
| `error` | Skipped — invalid row |

Settings UI uses a **Review EAN mapping import** modal with color-coded rows (`new`, `replace`, `warning`, `error`, `unchanged`). Replacement rows show the existing Zap EAN struck through; checkboxes control which rows are applied.

---

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/ean-mappings/export` | Download current mappings CSV |
| `POST` | `/api/ean-mappings/import/preview` | Parse CSV → preview stats + rows |
| `POST` | `/api/ean-mappings/import/apply` | Apply with `confirmReplaces` when needed |

Implementation: [`eanMappingsImportService.ts`](../../src/server/services/eanMappingsImportService.ts)

---

## Tests

- [`ean-mappings-import.test.ts`](../../tests/unit/ean-mappings-import.test.ts)
