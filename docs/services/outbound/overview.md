# Outbound logistics — overview

## Responsibility

Manage **channel (outbound) purchase orders**, **consignments**, **attachments**, **company/delivery metadata**, and **operator workflows** (acknowledge, cancel, reports, labels).

**Primary services:** `outboundPurchaseOrdersService.ts`, `outboundConsignmentsService.ts`, `outboundConsignmentItemsService.ts`, `outboundPoLogsService.ts`, `labelPdfService.ts` (labels PDF), utilities for pendency PDF and spreadsheet parse.

## Key concepts

| Concept | Meaning |
|---------|---------|
| `outbound_purchase_orders` | PO header: `po_number`, company, delivery, statuses, `listings_snapshot` JSONB, analytics |
| `outbound_consignments` | Fulfilment/consignment rows from eAutomate sync; `raw` JSONB + list columns |
| `outbound_consignment_items` | Per-consignment SKU/box lines (`043`) |
| `outbound_po_logs` | Activity lines from eAutomate (`044`) |
| **Local workflow** | `POST .../eautomate-actions` updates DB and generates CSV/PDF in Zap — **no dependency** on upstream for ack/cancel/reports when configured |

## Dependencies

| Internal | External |
|----------|----------|
| `companies`, `delivery_locations` | eAutomate list/detail sync (optional) |
| `zapStorage.ts` | Supabase for Zap-uploaded PO files |
| `pdf-lib`, `bwip-js` | Label/pendency PDF generation |

## Edge cases

- **`listings_snapshot`** may be empty for some POs; SKU reports and labels can fall back to **`outbound_consignment_items`** or other builders — see route handlers.
- **Partial POs** use separate UI (`/outbound/partial`) with delete affordances.

## See also

- [workflows.md](workflows.md)
- [api.md](api.md)
- [data-model.md](data-model.md)
