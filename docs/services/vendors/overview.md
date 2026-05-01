# Vendors — overview

## Responsibility

**Vendor master** (`vendors`), specialties, and **many-to-many** links to listings (`vendor_sku`). Supports vendor-scoped listing grids and inbound navigation.

**Service:** `vendorsService.ts`.

## Dependencies

- Inbound POs: `vendor_purchase_orders` reference `vendor_id`
- RBAC: vendor create/update may require elevated permissions (see route handlers)

## See also

- [api.md](api.md)
