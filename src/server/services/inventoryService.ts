// @ts-nocheck
import { query } from '@/server/db';

function formatListingForSkuWise(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sku_id: row.sku_id,
    master_sku: row.master_sku,
    inventory_sku_id: row.inventory_sku_id,
    pack_combo_sku_id: row.pack_combo_sku_id,
    sku_type: row.sku_type,
    inventory_bypass_on: row.inventory_bypass_on,
    ops_tag: row.ops_tag,
    category: row.category,
    description: row.description,
    meta_fields: row.meta_fields,
    img_hd: row.img_hd,
    img_white: row.img_white,
    img_wdim: row.img_wdim,
    img_link1: row.img_link1,
    img_link2: row.img_link2,
    no_of_constituents: row.no_of_constituents,
    actual_weight: Number(row.actual_weight ?? 0),
    dimension: row.dimension,
    created_at: row.raw_created_at,
    updated_at: row.raw_updated_at,
    bulk_price: Number(row.bulk_price ?? 0),
    keyword_pool: row.keyword_pool,
    material_info: row.material_info,
  };
}

export async function getPacksAndCombosPaginated(searchKeyword, page, count) {
  const offset = (page - 1) * count;
  const fromClause = `
    (SELECT parent_sku_id AS pack_combo_sku_id FROM pack_combos
     UNION
     SELECT pack_combo_sku_id FROM secondary_listings
     WHERE pack_combo_sku_id IS NOT NULL AND pack_combo_sku_id != 'NA') AS combined
  `;
  let whereClause = '';
  const params = [];
  if (searchKeyword) {
    params.push(`%${searchKeyword}%`);
    whereClause = 'WHERE pack_combo_sku_id ILIKE $1';
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM (SELECT DISTINCT pack_combo_sku_id FROM ${fromClause}) u ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, count, offset];
  const listQuery = `
    SELECT pack_combo_sku_id FROM (
      SELECT DISTINCT pack_combo_sku_id FROM ${fromClause}
    ) u ${whereClause}
    ORDER BY pack_combo_sku_id LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  const listResult = await query(listQuery, listParams);
  const content = listResult.rows.map((r) => ({ pack_combo_sku_id: r.pack_combo_sku_id }));

  return {
    total,
    current_page: page,
    per_page_count: count,
    curr_page_count: content.length,
    content,
  };
}

export async function getSecondaryListingsPaginated(searchKeyword, page, count) {
  const offset = (page - 1) * count;
  let whereClause = '';
  const params = [];
  if (searchKeyword) {
    params.push(`%${searchKeyword}%`);
    whereClause = `WHERE secondary_sku ILIKE $1 OR master_sku ILIKE $1 OR inventory_sku_id ILIKE $1 OR COALESCE(pack_combo_sku_id::text,'') ILIKE $1`;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM secondary_listings ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, count, offset];
  const listQuery = `SELECT id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
     sku_type, inventory_bypass_status, ais_quantity, available_quantity
     FROM secondary_listings ${whereClause}
     ORDER BY id LIMIT $${limitParam} OFFSET $${offsetParam}`;

  const listResult = await query(listQuery, listParams);
  const content = listResult.rows.map((r) => ({
    id: Number(r.id),
    secondary_sku: r.secondary_sku,
    master_sku: r.master_sku,
    inventory_sku_id: r.inventory_sku_id,
    pack_combo_sku_id: r.pack_combo_sku_id,
    sku_type: r.sku_type,
    inventory_bypass_status: r.inventory_bypass_status,
    ais_quantity: r.ais_quantity,
    available_quantity: r.available_quantity,
    effective_available_quantity: r.available_quantity,
  }));

  return {
    total,
    current_page: page,
    per_page_count: count,
    curr_page_count: content.length,
    content,
  };
}

export async function getSkuWiseDetails(secondarySku) {
  const secResult = await query(
    `SELECT id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
            sku_type, inventory_bypass_status, ais_quantity, available_quantity
     FROM secondary_listings WHERE secondary_sku = $1`,
    [secondarySku]
  );
  const secRow = secResult.rows[0];

  let master_sku = secondarySku;
  let inventory_sku_id = secondarySku;
  let pack_combo_sku_id = 'NA';

  if (secRow) {
    master_sku = secRow.master_sku || secondarySku;
    inventory_sku_id = secRow.inventory_sku_id !== 'NA' ? secRow.inventory_sku_id : master_sku;
    pack_combo_sku_id = secRow.pack_combo_sku_id || 'NA';
  }

  const secondary_sku_listing = secRow
    ? {
        id: Number(secRow.id),
        secondary_sku: secRow.secondary_sku,
        master_sku: secRow.master_sku,
        inventory_sku_id: secRow.inventory_sku_id,
        pack_combo_sku_id: secRow.pack_combo_sku_id,
        sku_type: secRow.sku_type,
        inventory_bypass_status: secRow.inventory_bypass_status,
        ais_quantity: secRow.ais_quantity,
        available_quantity: secRow.available_quantity,
      }
    : null;

  const masterListingResult = await query(
    `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
            actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at
     FROM listings WHERE sku_id = $1`,
    [master_sku]
  );
  const masterListing = masterListingResult.rows[0];

  const invListingResult = await query(
    `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
            actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at
     FROM listings WHERE sku_id = $1`,
    [inventory_sku_id]
  );
  const invListing = invListingResult.rows[0];

  const inventory_sku_available_quantity = invListing?.available_quantity ?? 0;
  const master_sku_bypass_inventory = masterListing?.inventory_bypass_on === 'YES' ? 1 : 0;

  let pack_combo_sku_listing = null;
  let pack_combo_childs = null;

  if (pack_combo_sku_id && pack_combo_sku_id !== 'NA') {
    const packListingResult = await query(
      `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
              inventory_bypass_on, ops_tag, category, description, meta_fields,
              img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
              actual_weight, dimension, bulk_price, keyword_pool, material_info,
              available_quantity, raw_created_at, raw_updated_at
       FROM listings WHERE sku_id = $1`,
      [pack_combo_sku_id]
    );
    pack_combo_sku_listing = formatListingForSkuWise(packListingResult.rows[0]);

    const childsResult = await query(
      `SELECT id, parent_sku_id, component_sku_id, quantity, created_at
       FROM pack_combos WHERE parent_sku_id = $1`,
      [pack_combo_sku_id]
    );
    pack_combo_childs = childsResult.rows.length > 0 ? childsResult.rows : null;
  }

  return {
    secondary_sku_listing,
    master_sku_bypass_inventory,
    master_sku_listing: formatListingForSkuWise(masterListing),
    inventory_sku_available_quantity,
    inventory_sku_listing: formatListingForSkuWise(invListing),
    pack_combo_sku_listing,
    pack_combo_childs,
  };
}
