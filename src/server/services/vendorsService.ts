// @ts-nocheck
import { query } from '@/server/db';

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

export async function getVendorListings(vendorId) {
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
          description: l.description ?? '',
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
