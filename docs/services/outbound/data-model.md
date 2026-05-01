# Outbound logistics — data model

Authoritative DDL: migrations `021`, `036`–`040`, `043`, `044`. Summary: [../../architecture/database-schema.md](../../architecture/database-schema.md).

## Main tables

| Table | Notes |
|-------|--------|
| `companies` | Channel buyers; synced from eAutomate |
| `delivery_locations` | Named locations for POs |
| `outbound_purchase_orders` | PO header; `listings_snapshot` JSONB (`040`); `eautomate_raw`, `eautomate_synced_at` (`037`); attachments meta (`036`) |
| `outbound_po_eautomate_files` | File metadata from eAutomate; `zap_storage_path` (`042`) |
| `outbound_po_attachments` | Zap-uploaded files (`036`) |
| `outbound_consignments` | Consignment list rows + `raw`; `detail_raw`, `detail_synced_at` (`043`) |
| `outbound_consignment_delivery_locations` | Location directory for filters |
| `outbound_consignment_items` | SKU/box lines per consignment / PO (`043`) |
| `outbound_transporter_details` | Transporter master (`043`) |
| `outbound_valid_box_names` | Box name list (`043`) |
| `outbound_po_logs` | Activity log (`044`) |

## Relationships (logical)

- `outbound_purchase_orders.company_id` → `companies` (nullable)
- `outbound_po_logs.outbound_po_id` → `outbound_purchase_orders` ON DELETE CASCADE
- `outbound_consignment_items.consignment_id` → `outbound_consignments` ON DELETE CASCADE

## See also

- [workflows.md](workflows.md)
