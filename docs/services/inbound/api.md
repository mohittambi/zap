# Inbound logistics — API

Base path: `/api/inbound`

All routes require auth unless noted. Permission checks vary by route (often `purchase_orders` or inbound-specific resources).

| Methods | Path | Description |
|---------|------|-------------|
| POST, GET | `/inbound/grns` | Create draft GRN / list GRNs |
| GET, PATCH | `/inbound/grns/[grnId]` | GRN detail + update status fields. Setting terminal `grn_audit_status` (`CLOSED` / `AUDITED` / `DONE` / `COMPLETED`) requires **`admin` role**; logs `AUDIT_DENIED` on 403, `AUDIT` on success; triggers rate-diff DN when applicable |
| GET | `/inbound/grns/[grnId]/details` | Full bundle for GRN detail UI |
| PATCH | `/inbound/grns/[grnId]/items/[lineIndex]` | Update GRN line quantities/prices. Returns **409** when `grn_audit_status` is terminal; logs `AUDIT_LOCKED` |
| GET | `/inbound/grns/[grnId]/files/[fileId]` | Download invoice/attachment file |
| POST | `/inbound/grns/[grnId]/upload-zap` | Upload file to Zap Storage |
| GET | `/inbound/lot-listings` | Lot listing search (eAutomate-backed query) |
| GET | `/inbound/purchase-orders` | Inbound PO list view |
| GET, POST | `/inbound/vendor-purchase-orders` | Vendor PO list / create |
| GET | `/inbound/vendor-purchase-orders/export` | Export vendor POs |
| GET | `/inbound/pending-audits/grns` | Pending audit queue; includes `grn_audit_price_total` per row |
| GET | `/inbound/pending-invoice-collection/grns` | Pending invoice collection |
| GET | `/inbound/pending-debit-credit/notes` | Pending debit/credit notes |
| GET | `/inbound/skus/[skuId]/inbound-summary` | SKU inbound summary |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/details` | PO detail bundle |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/document` | Document download |
| GET | `/inbound/vendors/[id]/purchase-orders/[poId]/grn-report` | GRN report (CSV/PDF per implementation) |
| PATCH | `/inbound/vendors/[id]/purchase-orders/[poId]/modify` | Merge notes into `po_raw` |
| PATCH | `/inbound/vendors/[id]/purchase-orders/[poId]/cancel` | Local cancel flags in `po_raw` |

**Error responses:** JSON `{ error, hint? }` with 4xx/5xx.

**Implementation:** each `route.ts` under `web/src/app/api/inbound/`.
