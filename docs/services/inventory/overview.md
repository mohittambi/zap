# Inventory (secondary, packs, bins) — overview

## Responsibility

- **Secondary listings** — paginated views, SKU-wise merge of eAutomate `sku_wise_details`, company associations, label patch endpoints.
- **Packs & combos** — parent/child relationships (`pack_combos`) and paginated discovery.
- **Bins** — warehouse bin placement per SKU (`binsService`).
- **Warehouse dump** — movement-style rows in `warehouse_inventory_dump`.

**Services:** `inventoryService.ts`, `packsCombosService.ts`, `binsService.ts`, `warehouseInventoryService.ts`.

## Pipeline note

Historical planning for warehouse ↔ PO pipeline lived in `warehouse-inventory-po-pipeline-plan.md`; operational truth is **migrations + services** above.

## See also

- [api.md](api.md)
- [../listings/overview.md](../listings/overview.md)
