// @ts-nocheck
import { query } from '@/server/db';
import { AppError } from '@/server/errors';
import * as companySkuService from '@/server/services/companySkuService';

function jsonbCompanyDetails(row) {
  const v = row?.company_details;
  if (Array.isArray(v)) return v;
  return [];
}

function jsonbLabelsData(row) {
  const v = row?.labels_data;
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return {};
}

function jsonbRawSkuWise(row) {
  const v = row?.sku_wise_details_raw;
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return {};
}

/** Same as sync script: unwrap `data` / `content` envelope from stored POST JSON. */
function unwrapSkuWisePayload(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return {};
  if (data.data != null && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data;
  }
  if (
    data.content != null &&
    typeof data.content === 'object' &&
    !Array.isArray(data.content)
  ) {
    return data.content;
  }
  return data;
}

function normalizeEautomateListing(api) {
  if (!api || typeof api !== 'object') return null;
  const bins = Array.isArray(api.bins) ? api.bins : [];
  return {
    ...api,
    actual_weight: Number(api.actual_weight ?? 0),
    bulk_price: Number(api.bulk_price ?? 0),
    available_quantity: Number(api.available_quantity ?? 0),
    bins,
  };
}

const LISTING_ROW_SELECT = `id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
            actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at, eautomate_bins`;

function extractLabelsFromSkuWiseRaw(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const candidates = [
    raw.secondary_sku_labels_data,
    raw.data?.secondary_sku_labels_data,
    raw.content?.secondary_sku_labels_data,
    raw.labels_data,
    raw.data?.labels_data,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) return c;
  }
  return {};
}

function extractCompaniesFromSkuWiseRaw(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidates = [
    raw.secondary_sku_company_details,
    raw.data?.secondary_sku_company_details,
    raw.content?.secondary_sku_company_details,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return null;
}

function mergeSecondaryLabels(fromDb, fromRaw) {
  const a = fromDb && typeof fromDb === 'object' && !Array.isArray(fromDb) ? fromDb : {};
  const b = fromRaw && typeof fromRaw === 'object' && !Array.isArray(fromRaw) ? fromRaw : {};
  return { ...b, ...a };
}

function mergeSecondaryCompanies(fromDb, fromRaw) {
  const a = Array.isArray(fromDb) ? fromDb : [];
  const b = Array.isArray(fromRaw) ? fromRaw : [];
  const seen = new Set();
  const out = [];
  for (const x of [...a, ...b]) {
    if (!x || typeof x !== 'object') continue;
    const k = x.company_id != null ? `id:${x.company_id}` : `n:${x.company_name ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function associatedCompaniesCount(row) {
  const v = row?.company_details;
  if (Array.isArray(v)) return v.length;
  return 0;
}

function formatListingForSkuWise(row) {
  if (!row) return null;
  const bins = Array.isArray(row.eautomate_bins) ? row.eautomate_bins : [];
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
    available_quantity: Number(row.available_quantity ?? 0),
    bins,
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

export async function getSecondaryListingsPaginated(searchKeyword, page, count, skuType?: string) {
  const offset = (page - 1) * count;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (searchKeyword) {
    params.push(`%${searchKeyword}%`);
    conditions.push(
      `(secondary_sku ILIKE $${params.length} OR master_sku ILIKE $${params.length} OR inventory_sku_id ILIKE $${params.length} OR COALESCE(pack_combo_sku_id::text,'') ILIKE $${params.length})`
    );
  }
  if (skuType && skuType !== 'ALL') {
    params.push(skuType.toUpperCase());
    conditions.push(`sku_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM secondary_listings ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const listParams = [...params, count, offset];
  const listQuery = `SELECT id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
     sku_type, inventory_bypass_status, ais_quantity, available_quantity,
     company_details, labels_data, synced_at,
     CASE WHEN jsonb_typeof(company_details) = 'array' THEN jsonb_array_length(company_details) ELSE 0 END AS associated_companies_count
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
    associated_companies_count: Number(r.associated_companies_count ?? 0),
    secondary_sku_company_details: jsonbCompanyDetails(r),
    secondary_sku_labels_data: jsonbLabelsData(r),
    synced_at: r.synced_at
      ? new Date(r.synced_at).toISOString().replace(/\.\d{3}Z$/, '.000000Z')
      : null,
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
            sku_type, inventory_bypass_status, ais_quantity, available_quantity,
            company_details, labels_data, sku_wise_details_raw
     FROM secondary_listings WHERE secondary_sku = $1`,
    [secondarySku]
  );
  const secRow = secResult.rows[0];
  const skuWiseRaw = secRow ? jsonbRawSkuWise(secRow) : {};
  const rawUnwrapped = unwrapSkuWisePayload(skuWiseRaw);

  const whSecondaryResult = await query(
    `SELECT ${LISTING_ROW_SELECT}
     FROM listings WHERE sku_id = $1`,
    [secondarySku]
  );
  const warehouse_secondary_listing = formatListingForSkuWise(whSecondaryResult.rows[0]);

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
        associated_companies_count: associatedCompaniesCount(secRow),
      }
    : null;

  const masterListingResult = await query(
    `SELECT ${LISTING_ROW_SELECT}
     FROM listings WHERE sku_id = $1`,
    [master_sku]
  );
  const masterListing = masterListingResult.rows[0];

  const invListingResult = await query(
    `SELECT ${LISTING_ROW_SELECT}
     FROM listings WHERE sku_id = $1`,
    [inventory_sku_id]
  );
  const invListing = invListingResult.rows[0];

  let master_sku_listing =
    rawUnwrapped.master_sku_listing && typeof rawUnwrapped.master_sku_listing === 'object'
      ? normalizeEautomateListing(rawUnwrapped.master_sku_listing)
      : formatListingForSkuWise(masterListing);

  let inventory_sku_listing =
    rawUnwrapped.inventory_sku_listing && typeof rawUnwrapped.inventory_sku_listing === 'object'
      ? normalizeEautomateListing(rawUnwrapped.inventory_sku_listing)
      : formatListingForSkuWise(invListing);

  const inventory_sku_available_quantity = Number(
    inventory_sku_listing?.available_quantity ?? invListing?.available_quantity ?? 0
  );
  const master_sku_bypass_inventory = master_sku_listing?.inventory_bypass_on === 'YES' ? 1 : 0;

  let pack_combo_sku_listing = null;
  let pack_combo_components = [];
  let pack_combo_childs = [];

  if (rawUnwrapped.pack_combo_sku_listing && typeof rawUnwrapped.pack_combo_sku_listing === 'object') {
    pack_combo_sku_listing = normalizeEautomateListing(rawUnwrapped.pack_combo_sku_listing);
  }

  const rawChilds = rawUnwrapped.pack_combo_childs;
  if (Array.isArray(rawChilds) && rawChilds.length > 0) {
    pack_combo_childs = rawChilds;
    pack_combo_components = rawChilds
      .map((c) => {
        const component_sku_id = String(
          c.inventory_sku_id ?? c.component_sku_id ?? c.listing?.sku_id ?? ''
        ).trim();
        if (!component_sku_id) return null;
        return {
          id: c.id,
          pack_combo_sku_id: c.pack_combo_sku_id,
          component_sku_id,
          quantity: Number(c.sku_count ?? c.quantity ?? 1),
          listing: normalizeEautomateListing(c.listing) ?? null,
        };
      })
      .filter(Boolean);
  }

  if (pack_combo_sku_id && pack_combo_sku_id !== 'NA') {
    if (!pack_combo_sku_listing) {
      const packListingResult = await query(
        `SELECT ${LISTING_ROW_SELECT}
         FROM listings WHERE sku_id = $1`,
        [pack_combo_sku_id]
      );
      pack_combo_sku_listing = formatListingForSkuWise(packListingResult.rows[0]);
    }

    if (pack_combo_components.length === 0) {
      const childsResult = await query(
        `SELECT component_sku_id, quantity
         FROM pack_combos WHERE parent_sku_id = $1
         ORDER BY id`,
        [pack_combo_sku_id]
      );
      const skuIds = childsResult.rows.map((r) => r.component_sku_id).filter(Boolean);
      const listingsBySku = new Map();
      if (skuIds.length > 0) {
        const lr = await query(
          `SELECT ${LISTING_ROW_SELECT}
           FROM listings WHERE sku_id = ANY($1::text[])`,
          [skuIds]
        );
        for (const row of lr.rows) listingsBySku.set(row.sku_id, row);
      }
      pack_combo_components = childsResult.rows.map((r) => ({
        component_sku_id: r.component_sku_id,
        quantity: Number(r.quantity ?? 1),
        listing: formatListingForSkuWise(listingsBySku.get(r.component_sku_id)),
      }));
    }
  }

  let secondary_sku_company_details = mergeSecondaryCompanies(
    extractCompaniesFromSkuWiseRaw(skuWiseRaw) ?? [],
    extractCompaniesFromSkuWiseRaw(rawUnwrapped) ?? []
  );
  if (secRow) {
    secondary_sku_company_details = mergeSecondaryCompanies(
      jsonbCompanyDetails(secRow),
      secondary_sku_company_details
    );
  }

  const cssAssocs =
    await companySkuService.fetchCompanyAssociationsForSecondarySku(secondarySku);
  secondary_sku_company_details = mergeSecondaryCompanies(
    cssAssocs,
    secondary_sku_company_details
  );

  const labelsMergedFromRaw = mergeSecondaryLabels(
    extractLabelsFromSkuWiseRaw(rawUnwrapped),
    extractLabelsFromSkuWiseRaw(skuWiseRaw)
  );
  const secondary_sku_labels_data = secRow
    ? mergeSecondaryLabels(jsonbLabelsData(secRow), labelsMergedFromRaw)
    : mergeSecondaryLabels({}, labelsMergedFromRaw);

  return {
    secondary_sku_listing,
    warehouse_secondary_listing,
    secondary_sku_company_details,
    secondary_sku_labels_data,
    sku_wise_details_raw: secRow ? jsonbRawSkuWise(secRow) : {},
    master_sku_bypass_inventory,
    master_sku_listing,
    inventory_sku_available_quantity,
    inventory_sku_listing,
    pack_combo_sku_listing,
    pack_combo_childs,
    pack_combo_components,
  };
}

/**
 * Persist label fields into secondary_listings.labels_data (JSON merge).
 * Mandatory fields are enforced by the API route before calling this.
 */
export async function updateLabelsData(
  secondarySku,
  fields
) {
  const secondary_sku = String(secondarySku ?? '').trim();
  if (!secondary_sku) throw new AppError('secondary_sku is required', 400);

  const patch = {
    secondary_sku,
    ean_code:
      fields.ean_code != null ? String(fields.ean_code).trim() || 'NA' : 'NA',
    size: fields.size != null ? String(fields.size).trim() : '',
    color: fields.color != null ? String(fields.color).trim() : '',
    one_set_contains:
      fields.one_set_contains != null ? String(fields.one_set_contains).trim() : '',
    mrp:
      fields.mrp != null && fields.mrp !== ''
        ? Number(fields.mrp)
        : NaN,
    material: fields.material != null ? String(fields.material).trim() : '',
  };

  if (!patch.size) throw new AppError('size is required', 400);
  if (!patch.color) throw new AppError('color is required', 400);
  if (!patch.one_set_contains) throw new AppError('one_set_contains is required', 400);
  if (!Number.isFinite(patch.mrp)) throw new AppError('mrp must be a valid number', 400);
  if (!patch.material) throw new AppError('material is required', 400);

  const r = await query(
    `UPDATE secondary_listings
     SET labels_data = COALESCE(labels_data, '{}'::jsonb) || $1::jsonb
     WHERE secondary_sku = $2
     RETURNING labels_data`,
    [JSON.stringify(patch), secondary_sku]
  );
  if (r.rows.length === 0) {
    throw new AppError('Secondary SKU not found', 404);
  }
  const labels_data = jsonbLabelsData(r.rows[0]);
  return { secondary_sku_labels_data: labels_data };
}
