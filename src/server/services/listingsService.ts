// @ts-nocheck
import { query } from '@/server/db';
import {
  LISTING_STOCK_CTE,
  listingOrderBy,
  stockStateClause,
  type ListingSort,
  type StockState,
} from '@/server/sql/listingStockCte';

export async function getSkuNames() {
  const result = await query(
    `SELECT sku_id, description FROM listings ORDER BY sku_id`
  );
  return result.rows;
}

export async function getListingBySku(skuId) {
  const listingResult = await query(
    `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
            actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at
     FROM listings WHERE sku_id = $1`,
    [skuId]
  );
  const listing = listingResult.rows[0];
  if (!listing) return null;

  const binsResult = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted
     FROM bins WHERE sku_id = $1 AND is_deleted = false`,
    [skuId]
  );

  return {
    id: Number(listing.id),
    sku_id: listing.sku_id,
    master_sku: listing.master_sku,
    inventory_sku_id: listing.inventory_sku_id,
    pack_combo_sku_id: listing.pack_combo_sku_id,
    sku_type: listing.sku_type,
    inventory_bypass_on: listing.inventory_bypass_on,
    ops_tag: listing.ops_tag,
    category: listing.category,
    description: listing.description,
    meta_fields: listing.meta_fields,
    img_hd: listing.img_hd,
    img_white: listing.img_white,
    img_wdim: listing.img_wdim,
    img_link1: listing.img_link1,
    img_link2: listing.img_link2,
    no_of_constituents: listing.no_of_constituents,
    actual_weight: Number(listing.actual_weight ?? 0),
    dimension: listing.dimension,
    created_at: listing.raw_created_at,
    updated_at: listing.raw_updated_at,
    bulk_price: Number(listing.bulk_price ?? 0),
    keyword_pool: listing.keyword_pool,
    material_info: listing.material_info,
    bins: binsResult.rows.map((b) => ({
      id: Number(b.id),
      warehouse_id: Number(b.warehouse_id),
      sku_id: b.sku_id,
      bin_id: b.bin_id,
      available_quantity: b.available_quantity,
      is_deleted: b.is_deleted ? 1 : 0,
    })),
    available_quantity: listing.available_quantity,
  };
}

export async function getListingsByPage(
  searchKeyword,
  page,
  count,
  filters?: {
    tag_ids?: number[];
    min_price?: number;
    max_price?: number;
    category?: string | null;
    stock_state?: StockState | null;
    sort?: ListingSort | null;
  }
) {
  const offset = (page - 1) * count;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (searchKeyword) {
    params.push(`%${searchKeyword}%`);
    conditions.push(
      `(l.sku_id ILIKE $${params.length} OR l.description ILIKE $${params.length} OR l.keyword_pool ILIKE $${params.length} OR l.category ILIKE $${params.length})`
    );
  }
  if (filters?.min_price != null) {
    params.push(filters.min_price);
    conditions.push(`l.bulk_price >= $${params.length}`);
  }
  if (filters?.max_price != null) {
    params.push(filters.max_price);
    conditions.push(`l.bulk_price <= $${params.length}`);
  }
  if (filters?.category) {
    if (filters.category === "(uncategorised)") {
      conditions.push(`(l.category IS NULL OR TRIM(l.category) IN ('', '-'))`);
    } else {
      params.push(filters.category);
      conditions.push(`l.category = $${params.length}`);
    }
  }
  if (filters?.tag_ids && filters.tag_ids.length > 0) {
    const tagIdsIdx = params.length + 1;
    const tagCountIdx = params.length + 2;
    params.push(filters.tag_ids, filters.tag_ids.length);
    conditions.push(
      `l.sku_id IN (
        SELECT sku_id FROM sku_tag_assignments
        WHERE tag_id = ANY($${tagIdsIdx})
        GROUP BY sku_id HAVING COUNT(DISTINCT tag_id) = $${tagCountIdx}
      )`
    );
  }
  const stockClause = stockStateClause(filters?.stock_state, "s");
  if (stockClause) conditions.push(stockClause);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = listingOrderBy(filters?.sort);

  const countResult = await query(
    `${LISTING_STOCK_CTE}
     SELECT COUNT(*)::int AS total
     FROM   listings l
     LEFT   JOIN ls_stock s ON s.sku_id = l.sku_id
     ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, count, offset];
  const listQuery = `${LISTING_STOCK_CTE}
     SELECT l.id, l.sku_id, l.master_sku, l.inventory_sku_id, l.pack_combo_sku_id, l.sku_type,
            l.inventory_bypass_on, l.ops_tag, l.category, l.description, l.meta_fields,
            l.img_hd, l.img_white, l.img_wdim, l.img_link1, l.img_link2, l.no_of_constituents,
            l.actual_weight, l.dimension, l.bulk_price, l.keyword_pool, l.material_info,
            l.available_quantity, l.raw_created_at, l.raw_updated_at,
            COALESCE(s.bin_qty, 0) AS live_bin_qty
     FROM   listings l
     LEFT   JOIN ls_stock s ON s.sku_id = l.sku_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${limitParam} OFFSET $${offsetParam}`;

  const listResult = await query(listQuery, listParams);
  const content = listResult.rows;

  const skuIds = content.map((r) => r.sku_id);
  const binsBySku: Record<string, unknown[]> = {};
  if (skuIds.length > 0) {
    const binsResult = await query(
      `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted
       FROM bins WHERE sku_id = ANY($1) AND is_deleted = false`,
      [skuIds]
    );
    for (const b of binsResult.rows) {
      if (!binsBySku[b.sku_id]) binsBySku[b.sku_id] = [];
      binsBySku[b.sku_id].push({
        id: Number(b.id),
        warehouse_id: Number(b.warehouse_id),
        sku_id: b.sku_id,
        bin_id: b.bin_id,
        available_quantity: b.available_quantity,
        is_deleted: b.is_deleted ? 1 : 0,
      });
    }
  }

  return {
    total,
    current_page: page,
    per_page_count: count,
    curr_page_count: content.length,
    content: content.map((l) => ({
      id: Number(l.id),
      sku_id: l.sku_id,
      master_sku: l.master_sku,
      inventory_sku_id: l.inventory_sku_id,
      pack_combo_sku_id: l.pack_combo_sku_id,
      sku_type: l.sku_type,
      inventory_bypass_on: l.inventory_bypass_on,
      ops_tag: l.ops_tag,
      category: l.category,
      description: l.description,
      meta_fields: l.meta_fields,
      img_hd: l.img_hd,
      img_white: l.img_white,
      img_wdim: l.img_wdim,
      img_link1: l.img_link1,
      img_link2: l.img_link2,
      no_of_constituents: l.no_of_constituents,
      actual_weight: Number(l.actual_weight ?? 0),
      dimension: l.dimension,
      created_at: l.raw_created_at,
      updated_at: l.raw_updated_at,
      bulk_price: Number(l.bulk_price ?? 0),
      keyword_pool: l.keyword_pool,
      material_info: l.material_info,
      bins: binsBySku[l.sku_id] || [],
      available_quantity: l.available_quantity,
      live_bin_qty: Number(l.live_bin_qty ?? 0),
    })),
  };
}

export async function updateListingBySku(
  skuId: string,
  fields: {
    ops_tag?: string | null;
    category?: string | null;
    sku_type?: string | null;
    bulk_price?: number | null;
    no_of_constituents?: number | null;
  }
) {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if ('ops_tag' in fields) {
    setClauses.push(`ops_tag = $${idx++}`);
    params.push(fields.ops_tag ?? null);
  }
  if ('category' in fields) {
    setClauses.push(`category = $${idx++}`);
    params.push(fields.category ?? null);
  }
  if ('sku_type' in fields) {
    setClauses.push(`sku_type = $${idx++}`);
    params.push(fields.sku_type ?? null);
  }
  if ('bulk_price' in fields) {
    setClauses.push(`bulk_price = $${idx++}`);
    params.push(fields.bulk_price ?? null);
  }
  if ('no_of_constituents' in fields) {
    setClauses.push(`no_of_constituents = $${idx++}`);
    params.push(fields.no_of_constituents ?? null);
  }

  if (setClauses.length === 0) return null;

  params.push(skuId);
  const result = await query(
    `UPDATE listings SET ${setClauses.join(', ')} WHERE sku_id = $${idx} RETURNING sku_id`,
    params
  );
  if (result.rows.length === 0) return null;
  return getListingBySku(skuId);
}

export async function getInboundSummary(skuId) {
  const result = await query(
    `SELECT id, sku_id, summary_date, quantity, source, raw_data
     FROM inbound_summary WHERE sku_id = $1 ORDER BY summary_date DESC`,
    [skuId]
  );
  if (result.rows.length === 0) return [];
  return result.rows.map((r) => ({ ...r, raw_data: r.raw_data || undefined }));
}

export async function getIncomingQuantity(skuId) {
  const result = await query(
    `SELECT id, sku_id, quantity, expected_date, source, raw_data
     FROM incoming_quantity WHERE sku_id = $1 ORDER BY expected_date`,
    [skuId]
  );
  if (result.rows.length === 0) return [];
  return result.rows.map((r) => ({ ...r, raw_data: r.raw_data || undefined }));
}
