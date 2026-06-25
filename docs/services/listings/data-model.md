# Listings — data model

## `listings` (master)

Primary product row keyed by `sku_id` (VARCHAR). Notable columns: `master_sku`, `inventory_sku_id`, `pack_combo_sku_id`, `sku_type`, images, `dimension`, `material_info`, `available_quantity`, `eautomate_bins` JSONB (`035`).

### Image URL columns (5 slots)

| Column | Typical use |
|--------|-------------|
| `img_hd` | HD product image |
| `img_white` | White background |
| `img_wdim` | With dimensions |
| `img_link1` | Alternate 1 |
| `img_link2` | Alternate 2 |

**Production today:** TEXT URLs, often external CDN from eAutomate sync.

**Target (doctrine #14, not activated):** public Supabase Storage URLs under bucket `listing-images`, path `{sku_id}/{slot}.{ext}`. Bytes are not stored in Postgres.

See [../../.cursor/skills/listing-image-storage/SKILL.md](../../.cursor/skills/listing-image-storage/SKILL.md).

See [../../architecture/database-schema.md](../../architecture/database-schema.md) § Warehouses and listings core.

## `secondary_listings`

Extended marketplace-style rows: `secondary_sku`, company JSON, `labels_data`, `sku_wise_details_raw`, `synced_at` (`034`).

## Caches

- `inbound_summary`, `incoming_quantity` — per-SKU caches for API speed.
- `sku_analytics` — append-only analytics snapshots.

## Related

- `listing_order_details` — inbound PO line projection used in SKU/outbound summaries.
- `bins` — `(warehouse_id, sku_id, bin_id)` stock placement.
