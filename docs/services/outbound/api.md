# Outbound logistics — API

Base path: `/api/outbound`

| Methods | Path | Description |
|---------|------|-------------|
| GET | `/outbound/companies` | Companies directory for filters |
| GET | `/outbound/form-options` | Dropdown options for create/edit PO |
| GET | `/outbound/consignments` | List consignments |
| GET | `/outbound/consignments/filters` | Filter metadata |
| GET | `/outbound/consignments/[id]` | Consignment detail |
| GET | `/outbound/consignments/[id]/items` | Paginated SKU lines for a consignment (`outbound_consignment_items`, aggregated by SKU) |
| GET | `/outbound/consignments/[id]/logs` | PO log rows filtered by `consignment_id` |
| POST | `/outbound/consignments/[id]/boxes` | Append packing lines (`outbound_consignment_items`) for a new box (requires `purchase_orders` write) |
| GET | `/outbound/box-names` | Valid box names (`outbound_valid_box_names`) |
| GET, POST | `/outbound/purchase-orders` | List / create PO |
| GET | `/outbound/purchase-orders/filter-options` | Filter chips (delivery locations, etc.) |
| DELETE | `/outbound/purchase-orders/[id]` | Delete PO (constraints apply) |
| GET | `/outbound/purchase-orders/[id]/detail` | PO detail payload for UI |
| GET | `/outbound/purchase-orders/[id]/items` | Line items / consignment items view |
| GET | `/outbound/purchase-orders/[id]/logs` | `outbound_po_logs` |
| POST | `/outbound/purchase-orders/[id]/attachments` | Upload attachment metadata / file |
| GET | `/outbound/purchase-orders/[id]/attachments/[attachmentId]` | Download Zap attachment |
| GET, POST | `/outbound/purchase-orders/[id]/consignments` | List / create consignment link |
| POST | `/outbound/purchase-orders/[id]/eautomate-actions` | Workflow actions (ack, cancel, reports, label prep) |
| GET | `/outbound/purchase-orders/[id]/eautomate-files/[fileId]` | Download eAutomate-sourced file (or Storage) |
| POST | `/outbound/purchase-orders/[id]/files-zap` | Upload file to Zap Storage |

**Auth:** `requireAuth` + permission checks per route (e.g. `purchase_orders`).

**Implementation:** `web/src/app/api/outbound/**/*.ts`.
