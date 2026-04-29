// @ts-nocheck
import { query } from '@/server/db';
import { AppError } from '@/server/errors';

function str(v, maxLen) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

function mapSpecialty(s) {
  return {
    id: Number(s.id),
    vendor_id: Number(s.vendor_id),
    vendor_speciality: s.vendor_speciality,
    created_by: s.created_by,
    modified_by: s.modified_by,
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

function mapVendorRow(r, specialties = []) {
  return {
    id: Number(r.id),
    vendor_name: r.vendor_name,
    created_by: r.created_by,
    modified_by: r.modified_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    vendor_address_line: r.vendor_address_line ?? '',
    vendor_city: r.vendor_city ?? '',
    vendor_state: r.vendor_state ?? '',
    vendor_postal_code: r.vendor_postal_code ?? '',
    vendor_gstin: r.vendor_gstin ?? '',
    vendor_contact_number: r.vendor_contact_number ?? '',
    specialties,
  };
}

export async function getAllVendors() {
  const vResult = await query(
    `SELECT id, vendor_name, created_by, modified_by, created_at, updated_at,
            vendor_address_line, vendor_city, vendor_state, vendor_postal_code,
            vendor_gstin, vendor_contact_number
     FROM vendors ORDER BY id`
  );
  const vendorIds = vResult.rows.map((r) => r.id);
  if (vendorIds.length === 0) return [];

  const specResult = await query(
    `SELECT id, vendor_id, vendor_speciality, created_by, modified_by, created_at, updated_at
     FROM vendor_specialties WHERE vendor_id = ANY($1) ORDER BY vendor_id, id`,
    [vendorIds]
  );
  const specsByVendor = {};
  for (const s of specResult.rows) {
    if (!specsByVendor[s.vendor_id]) specsByVendor[s.vendor_id] = [];
    specsByVendor[s.vendor_id].push(mapSpecialty(s));
  }

  return vResult.rows.map((r) => mapVendorRow(r, specsByVendor[r.id] || []));
}

export async function getVendorById(id) {
  const vResult = await query(
    `SELECT id, vendor_name, created_by, modified_by, created_at, updated_at,
            vendor_address_line, vendor_city, vendor_state, vendor_postal_code,
            vendor_gstin, vendor_contact_number
     FROM vendors WHERE id = $1`,
    [id]
  );
  if (vResult.rows.length === 0) return null;

  const r = vResult.rows[0];
  const specResult = await query(
    `SELECT id, vendor_id, vendor_speciality, created_by, modified_by, created_at, updated_at
     FROM vendor_specialties WHERE vendor_id = $1 ORDER BY id`,
    [id]
  );
  const specialties = specResult.rows.map(mapSpecialty);
  return mapVendorRow(r, specialties);
}

/**
 * Create a vendor. If id is omitted, uses max(id)+1 (low-concurrency safe enough for internal use).
 */
export async function createVendor(input, actorEmail) {
  const vendor_name = str(input.vendor_name, 200);
  if (!vendor_name) {
    throw new AppError('vendor_name is required', 400);
  }

  let id =
    input.id != null && input.id !== ''
      ? Number(input.id)
      : null;
  if (id != null && (Number.isNaN(id) || id < 1 || !Number.isInteger(id))) {
    throw new AppError('Invalid vendor id', 400);
  }

  if (id == null) {
    const maxRes = await query(
      `SELECT COALESCE(MAX(id), 0)::bigint AS m FROM vendors`
    );
    id = Number(maxRes.rows[0].m) + 1;
  } else {
    const ex = await query(`SELECT 1 FROM vendors WHERE id = $1`, [id]);
    if (ex.rows.length > 0) {
      throw new AppError('Vendor id already exists', 409);
    }
  }

  const by = str(actorEmail, 100) || null;

  await query(
    `INSERT INTO vendors (
       id, vendor_name, created_by, modified_by, created_at, updated_at,
       vendor_address_line, vendor_city, vendor_state, vendor_postal_code,
       vendor_gstin, vendor_contact_number
     ) VALUES ($1, $2, $3, $3, NOW(), NOW(), $4, $5, $6, $7, $8, $9)`,
    [
      id,
      vendor_name,
      by,
      str(input.vendor_address_line),
      str(input.vendor_city, 100),
      str(input.vendor_state, 100),
      str(input.vendor_postal_code, 20),
      str(input.vendor_gstin, 50),
      str(input.vendor_contact_number, 50),
    ]
  );

  return getVendorById(id);
}

export async function updateVendor(id, input, actorEmail) {
  const by = str(actorEmail, 100) || null;
  const setClauses = [];
  const params = [];
  let idx = 1;

  const fields = [
    ['vendor_name', str(input.vendor_name, 200)],
    ['vendor_address_line', input.vendor_address_line == null ? undefined : str(input.vendor_address_line)],
    ['vendor_city', input.vendor_city == null ? undefined : str(input.vendor_city, 100)],
    ['vendor_state', input.vendor_state == null ? undefined : str(input.vendor_state, 100)],
    ['vendor_postal_code', input.vendor_postal_code == null ? undefined : str(input.vendor_postal_code, 20)],
    ['vendor_gstin', input.vendor_gstin == null ? undefined : str(input.vendor_gstin, 50)],
    ['vendor_contact_number', input.vendor_contact_number == null ? undefined : str(input.vendor_contact_number, 50)],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      if (col === 'vendor_name' && !val) throw new AppError('vendor_name cannot be empty', 400);
      setClauses.push(`${col} = $${idx++}`);
      params.push(val || null);
    }
  }

  if (setClauses.length === 0) throw new AppError('No fields to update', 400);

  setClauses.push(`modified_by = $${idx++}`);
  params.push(by);
  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  const result = await query(
    `UPDATE vendors SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id`,
    params
  );
  if (result.rows.length === 0) throw new AppError('Vendor not found', 404);
  return getVendorById(id);
}

export async function deleteVendor(id) {
  const poCheck = await query(`SELECT 1 FROM inbound_purchase_orders WHERE vendor_id = $1 LIMIT 1`, [id]);
  if (poCheck.rows.length > 0) {
    throw new AppError('Cannot delete vendor with existing purchase orders', 409);
  }
  const result = await query(`DELETE FROM vendors WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) throw new AppError('Vendor not found', 404);
  return { deleted: true };
}

export async function getVendorsBySku(skuId) {
  const vsResult = await query(
    `SELECT vs.id, vs.vendor_id, vs.sku_id, vs.cost_price, vs.modified_by, vs.created_at, vs.updated_at,
            v.vendor_name, v.created_by AS v_created_by, v.modified_by AS v_modified_by,
            v.created_at AS v_created_at, v.updated_at AS v_updated_at,
            v.vendor_address_line, v.vendor_city, v.vendor_state, v.vendor_postal_code,
            v.vendor_gstin, v.vendor_contact_number
     FROM vendor_sku vs
     JOIN vendors v ON v.id = vs.vendor_id
     WHERE vs.sku_id = $1`,
    [skuId]
  );
  const rows = vsResult.rows;
  if (rows.length === 0) return [];

  const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
  const specResult = await query(
    `SELECT id, vendor_id, vendor_speciality, created_by, modified_by, created_at, updated_at
     FROM vendor_specialties WHERE vendor_id = ANY($1)`,
    [vendorIds]
  );
  const specsByVendor = {};
  for (const s of specResult.rows) {
    if (!specsByVendor[s.vendor_id]) specsByVendor[s.vendor_id] = [];
    specsByVendor[s.vendor_id].push(mapSpecialty(s));
  }

  return rows.map((r) => ({
    id: Number(r.id),
    vendor_id: Number(r.vendor_id),
    sku_id: r.sku_id,
    cost_price: Number(r.cost_price ?? 0),
    modified_by: r.modified_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    vendor: {
      id: Number(r.vendor_id),
      vendor_name: r.vendor_name,
      created_by: r.v_created_by,
      modified_by: r.v_modified_by,
      created_at: r.v_created_at,
      updated_at: r.v_updated_at,
      vendor_address_line: r.vendor_address_line,
      vendor_city: r.vendor_city,
      vendor_state: r.vendor_state,
      vendor_postal_code: r.vendor_postal_code,
      vendor_gstin: r.vendor_gstin,
      vendor_contact_number: r.vendor_contact_number,
      specialties: specsByVendor[r.vendor_id] || [],
    },
  }));
}

/** Build Map sku_id -> display name from eautomate /listings/sku/names cache payload. */
function buildSkuNameMapFromPayload(payload) {
  const m = new Map();
  if (payload == null) return m;
  let arr = payload;
  if (!Array.isArray(payload)) {
    if (typeof payload === 'object') {
      arr =
        payload.data ??
        payload.content ??
        payload.names ??
        payload.sku_names ??
        [];
    } else {
      return m;
    }
  }
  if (!Array.isArray(arr)) return m;
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const sku = String(row.sku_id ?? row.skuId ?? '').trim();
    if (!sku) continue;
    const name = String(
      row.description ??
        row.name ??
        row.title ??
        row.listing_title ??
        row.product_name ??
        ''
    ).trim();
    if (name) m.set(sku, name);
  }
  return m;
}

async function fetchEautomateSkuNameMap() {
  try {
    const r = await query(
      `SELECT payload FROM eautomate_sku_names_cache WHERE id = 1 LIMIT 1`
    );
    if (r.rows.length === 0) return new Map();
    return buildSkuNameMapFromPayload(r.rows[0].payload);
  } catch {
    return new Map();
  }
}

export async function getVendorListings(vendorId) {
  const nameMap = await fetchEautomateSkuNameMap();
  const vsResult = await query(
    `SELECT id, vendor_id, sku_id, cost_price, modified_by, created_at, updated_at
     FROM vendor_sku WHERE vendor_id = $1 ORDER BY id`,
    [vendorId]
  );
  const rows = vsResult.rows;
  if (rows.length === 0) return [];

  const skuIds = rows.map((r) => r.sku_id);
  const listResult = await query(
    `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
            actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at
     FROM listings WHERE sku_id = ANY($1)`,
    [skuIds]
  );
  const listingsBySku = {};
  for (const l of listResult.rows) {
    listingsBySku[l.sku_id] = l;
  }

  const binsResult = await query(
    `SELECT id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted
     FROM bins WHERE sku_id = ANY($1) AND is_deleted = false`,
    [skuIds]
  );
  const binsBySku = {};
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

  return rows.map((r) => {
    const l = listingsBySku[r.sku_id];
    const eaName = nameMap.get(r.sku_id) ?? null;
    const descBase = l?.description ?? '';
    const description =
      eaName && String(eaName).trim() ? String(eaName).trim() : descBase;
    const listing = l
      ? {
          id: Number(l.id),
          sku_id: l.sku_id,
          master_sku: l.master_sku,
          inventory_sku_id: l.inventory_sku_id,
          pack_combo_sku_id: l.pack_combo_sku_id,
          sku_type: l.sku_type,
          inventory_bypass_on: l.inventory_bypass_on,
          ops_tag: l.ops_tag,
          category: l.category,
          description,
          eautomate_sku_name: eaName,
          meta_fields: l.meta_fields ?? '',
          img_hd: l.img_hd ?? '',
          img_white: l.img_white ?? '',
          img_wdim: l.img_wdim ?? '',
          img_link1: l.img_link1 ?? '',
          img_link2: l.img_link2 ?? '',
          no_of_constituents: l.no_of_constituents ?? 1,
          actual_weight: Number(l.actual_weight ?? 0),
          dimension: l.dimension ?? '',
          created_at: l.raw_created_at,
          updated_at: l.raw_updated_at,
          bulk_price: Number(l.bulk_price ?? 0),
          keyword_pool: l.keyword_pool ?? '',
          material_info: l.material_info ?? '',
          bins: binsBySku[r.sku_id] ?? [],
          available_quantity: Number(l.available_quantity ?? 0),
        }
      : null;
    return {
      id: Number(r.id),
      vendor_id: Number(r.vendor_id),
      sku_id: r.sku_id,
      cost_price: Number(r.cost_price ?? 0),
      modified_by: r.modified_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      listing,
    };
  });
}
