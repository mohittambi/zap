# Inbound GRN detail page — data sources and former UI copy

**Audience:** developers maintaining the goods receipt note (GRN) detail screen at `web/src/app/(app)/(logistics)/inbound/grns/[grnId]/page.tsx`.

**See also:** [eautomate-public-api-reference.md](./eautomate-public-api-reference.md) (full upstream path catalog), [sync-all-eautomate.md](./sync-all-eautomate.md) (orchestrated sync order), [inbound-po-detail-snapshot.md](./inbound-po-detail-snapshot.md) (PO detail `po_raw` / cancel).

## Why this document exists

End-user copy on the GRN detail page intentionally avoids internal jargon: “Zap”, “ingested”, raw eAutomate URL fragments, and “synced” phrasing that implied a specific pipeline to operators. This file keeps the **technical mapping** and **wording we removed** so future work (debugging, support, new fields) does not lose context.

## Bundle loaded by the page

The client loads a **bundle** (see inbound GRNs services / API route) that typically includes:

- **header** — GRN row (ids, quantities, status fields, etc.)
- **snapshot** — Enriched / cached detail (vendor display, PO fields, `synced_at`, raw fragments)
- **added_items** — PO lines with pendency + listing
- **grn_items** — GRN line items with listing
- **invoice_files** — Vendor invoice file metadata (and download URLs where applicable)
- **debit_credit_notes** — Debit/credit note rows for the GRN
- **grn_logs** — Activity log rows

Exact shapes live in the TypeScript types and service next to the API route.

## `snapshot.synced_at`

When present, the UI shows **“Details last refreshed {datetime}”** (no product name in copy). Semantically this is still the timestamp on the **stored detail snapshot** produced when GRN detail data was last merged into the database during ingest/sync—not a guarantee that the user clicked anything in the browser.

## UI section → typical upstream eAutomate paths

Paths are under the eAutomate public API base (see eAutomate reference). They are what sync/detail ingest calls use; the web UI no longer prints them.

| Area on screen | Typical upstream path fragment | Purpose |
|----------------|-------------------------------|---------|
| Added items (PO + pendency) | `/purchase_orders/addedItems/withListing/withPendency/` | Ordered vs pendency vs receipt-side quantities |
| GRN line items | `/purchase_orders/grn/items/withListing/` | Per-SKU line quantities for the GRN |
| GRN summary (documents tab) | Mixed: header row + snapshot fields; ingest may combine **cached** PO/header payload with **live** GRN detail | Explains the old phrase “from synced header / live GRN API” — implementation detail, not user-facing |
| Vendor Invoice | `/purchase_orders/grn/invoice_files/` | Invoice file list |
| Debit / Credit Notes | `/purchase_orders/grn/debit_credit_notes/` | Note headers and related fields |
| GRN Logs | `/purchase_orders/grn/logs/{grn_id}` | Chronological log lines; often fetched together with GRN detail ingest |

## Upload flow (developer note)

Uploading a reverse debit/credit file uses the app route `POST /api/inbound/grns/{grnId}/upload-zap`, which stores the binary in configured object storage when env is set. User-visible success copy is neutral (“File uploaded”), not storage branding.

## Former UI strings (archived for traceability)

| Location | Old copy | Replacement intent |
|----------|----------|-------------------|
| Page `AppPageTitle` description | “Goods receipt note — synced into Zap and cached in the database.” | Neutral overview of what the page is for |
| Added items card | “From `/purchase_orders/addedItems/...`” | Describes business meaning (PO lines + pendency) |
| GRN line items card | “From `/purchase_orders/grn/items/withListing/`” | Describes line-level receipt quantities |
| Empty tables | “No rows ingested.” | “No line items to show.” |
| After details tab tables | “Detail snapshot synced at …” | “Details last refreshed …” |
| GRN summary card | “Quantities and identifiers (from synced header / live GRN API).” | Same idea without pipeline vocabulary |
| PO status field label | “PO status (cached)” | “PO status” |
| Vendor Invoice card | “Files from `/purchase_orders/grn/invoice_files/`” | “Vendor invoice files attached to this GRN.” |
| Empty invoice files | “No invoice files ingested.” | “No invoice files attached.” |
| Debit/Credit card | “From `/purchase_orders/grn/debit_credit_notes/`” | “Debit and credit notes linked to this GRN.” |
| Empty debit/credit | “No debit/credit notes ingested…” | “No debit or credit notes for this GRN.” |
| Prepared downloadables note | Referenced “ingested API payloads” | Neutral note about CSV not being stored in-app |
| GRN Logs card | “From `/purchase_orders/grn/logs/{id}` — synced with GRN detail ingest.” | “Chronological activity for this GRN.” |
| Upload success toast | “File uploaded to Zap Storage” | “File uploaded” |
| Upload button `title` | “… to Zap Storage” | Describes the action without infra name |

When adding new UI on this page, keep **user-facing** text free of sync commands, migration numbers, and raw upstream paths; extend this doc if you need to document a new data source.
