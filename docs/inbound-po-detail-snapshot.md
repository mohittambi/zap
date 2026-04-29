# Inbound PO detail snapshot — `po_raw` fields and cancel

**Code:** `inbound_po_detail_snapshot.po_raw` (JSONB), filled by eAutomate PO detail ingest and patched by in-app actions.

## In-app fields (preserved on re-sync)

`PATCH /api/inbound/vendors/{vendorId}/purchase-orders/{poId}/cancel` merges into `po_raw`:

- `zap_status` — e.g. `CANCELLED`
- `zap_cancelled_at` — ISO timestamp
- `zap_cancelled_by` — user email

`PATCH .../modify` merges:

- `zap_notes`, `zap_modified_at`, `zap_modified_by`

**Re-ingest behavior:** `ingestPoDetailsByVendorAndPo` (eAutomate PO detail sync) overwrites `po_raw` with the latest upstream PO JSON. The service **merges the keys above** from the existing row before write so cancel/notes are not lost when the page loads with `?refresh=1` or a scheduled sync runs. See `INBOUND_PO_RAW_ZAP_MERGE_KEYS` in `eautomatePoDetailsIngestService.ts`.

## Cancel API

- **Route:** `PATCH` …`/cancel` (no body). Requires `purchase_orders` + `write`.
- **Idempotent:** If `zap_status` is already `CANCELLED`, returns `{ ok: true }` without error.
- **Not** a remote eAutomate cancel — it only updates the app database snapshot.

## UI

The PO detail page shows **Cancelled** when `zap_status === CANCELLED` (and styles the status badge). The **Cancel PO** action is disabled once cancelled. The old footer line about “Detail cache synced at …” was removed; see `inbound-grn-detail-ui-and-data-sources.md` for the same policy on operator-facing copy.
