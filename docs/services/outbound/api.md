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
| GET | `/outbound/consignments/[id]/po-listings` | Zap PO line items for consignment detail: `listings_snapshot` enriched with **this consignment’s** `packed_quantity` from `outbound_consignment_items` |
| GET | `/outbound/consignments/[id]/po-reference-files` | PO reference documents (Zap + eAutomate originals) for consignment detail |
| GET | `/outbound/consignments/[id]/logs` | Activity log entries for a consignment |
| GET | `/outbound/consignments/[id]/line-items/drafts` | Draft or saved SKU packing groups for the editor (`{ skus, source, poNumber }`) |
| GET | `/outbound/consignments/[id]/line-items/rows` | Flat saved box lines for post-RTD tab views (`{ rows: [...] }`) |
| POST | `/outbound/consignments/[id]/line-items/save` | Validate and save all consignment line items (`{ skus: [...] }`); rolls packed qty into PO `listings_snapshot` |
| POST | `/outbound/consignments/[id]/mark-rtd` | Mark consignment ready to dispatch (transporter, shipment type, docket) |
| POST | `/outbound/consignments/[id]/packing-upload/preview` | Preview legacy bin packing CSV/XLSX |
| POST | `/outbound/consignments/[id]/packing-upload/apply` | Apply bin packing upload (append or replace) |
| GET | `/outbound/box-names` | Valid bin names (`outbound_valid_box_names`) |
| GET | `/outbound/transporters` | Transporter directory (`outbound_transporter_details`) |
| GET, POST | `/outbound/purchase-orders` | List / create PO |
| GET | `/outbound/purchase-orders/filter-options` | Filter chips (delivery locations, etc.) |
| DELETE | `/outbound/purchase-orders/[id]` | Delete PO (constraints apply) |
| GET | `/outbound/purchase-orders/[id]/detail` | PO detail payload for UI |
| GET | `/outbound/purchase-orders/[id]/items` | Line items / consignment items view |
| GET | `/outbound/purchase-orders/[id]/logs` | `outbound_po_logs` |
| POST | `/outbound/purchase-orders/[id]/attachments` | Upload attachment metadata / file |
| GET | `/outbound/purchase-orders/[id]/attachments/[attachmentId]` | Download Zap attachment |
| GET, POST | `/outbound/purchase-orders/[id]/consignments` | List consignments; **POST creates empty consignment in Zap** (PO must be WIP and acknowledged; lines entered on detail) |
| POST | `/outbound/purchase-orders/[id]/eautomate-actions` | Workflow actions: `acknowledge`, `cancel`, `download_sku_report`, `download_pendency_pdf`, label prep — see [pendency-pdf.md](pendency-pdf.md) |
| POST | `/outbound/purchase-orders/bulk-sku-report` | Merged SKU Level Report XLSX for multiple PO ids (`{ ids: number[] }`, max 50) |
| POST | `/outbound/purchase-orders/bulk-pendency-pdf` | Pendency PDFs for multiple PO ids (`{ ids: number[], format: "zip" \| "merged" }`, max 50) |
| GET | `/outbound/purchase-orders/[id]/eautomate-files/[fileId]` | Download eAutomate-sourced file (or Storage) |
| POST | `/outbound/purchase-orders/[id]/files-zap` | Upload file to Zap Storage |

**Auth:** `requireAuth` + permission checks per route (e.g. `purchase_orders`).

**Implementation:** `web/src/app/api/outbound/**/*.ts`.
