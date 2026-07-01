# eAutomate integration — sync flows

**Doctrine:** Sync is **inbound only** (eAutomate → Zap). Sync does **not** update eAutomate; Zap UI saves (e.g. consignment **Save lines**) do **not** push packing upstream. See **[sync-doctrine.md](sync-doctrine.md)**.

## Orchestrator

`npm run sync:eautomate:all` — runs the ordered shell pipeline in `web/scripts/sync-all-eautomate.sh`. See [../../operations/sync-runbook.md](../../operations/sync-runbook.md) for flags and safety.

## Individual npm scripts (web/)

High-level map; exact behavior is in each script under `web/scripts/`:

| npm script | Purpose |
|------------|---------|
| `sync:vendor` / `sync:vendors:all` / `sync:vendors:detail-all` | Vendor master + detail |
| `sync:vendor-pos` / `sync:vendor-pos:all` | Vendor PO lists |
| `sync:grns:all` / `sync:grns:pending-audit` / `sync:grns:pending-invoice-collection` | GRN lists and queues |
| `sync:secondary-listings` | Secondary listings + labels master enrichment |
| `sync:outbound-companies` | Companies directory |
| `sync:outbound-partial-pos` / `sync:outbound-pos:all` / `sync:outbound-po-detail` | Outbound PO headers and detail |
| `sync:outbound-consignments` / `sync:outbound-consignment-items` | Consignments and line items |
| `sync:po:details` | Inbound PO detail ingest |
| `sync:grn:details` / `sync:grn:details:all` | GRN detail snapshots |

## Server-triggered sync

Some API routes call `syncOutboundPurchaseOrderDetailFromEautomate` or similar when `eautomateConfigured()` — see individual route handlers.

## Data landing zones

| Source area | Typical Postgres targets |
|-------------|-------------------------|
| Companies / delivery locations | `companies`, `outbound_consignment_delivery_locations` |
| Outbound PO list | `outbound_purchase_orders`, `listings_snapshot` |
| Consignments | `outbound_consignments`, `outbound_consignment_items` |
| GRN / PO detail | `inbound_grn_detail_*`, `inbound_po_detail_*` |

## See also

- [api-reference.md](api-reference.md)
