/**
 * Shared PostgreSQL upserts for eautomate vendor + vendor listings sync.
 * Used by sync-eautomate-vendor.mjs and sync-eautomate-vendors-detail-all.mjs.
 */

export function parseTimestamptz(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1 || y > 9999) return null;
  return d.toISOString();
}

export function num(v, fallback = null) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function boolDeleted(v) {
  if (v === true || v === 1 || v === "1") return true;
  return false;
}

export function collectWarehouseIds(listingRows) {
  const warehouseIds = new Set();
  for (const item of listingRows) {
    const L = item?.listing;
    if (!L?.bins) continue;
    for (const b of L.bins) {
      if (b?.warehouse_id != null) warehouseIds.add(Number(b.warehouse_id));
    }
  }
  return warehouseIds;
}

export async function upsertWarehouse(client, id) {
  const wid = Number(id);
  await client.query(
    `INSERT INTO warehouses (id, name, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       updated_at = NOW()`,
    [wid, `WH-${wid}`]
  );
}

export async function upsertListing(client, L) {
  if (!L || !L.sku_id) return;
  const lid = num(L.id);
  if (lid == null) return;
  const rawCreated = parseTimestamptz(L.created_at);
  const rawUpdated = parseTimestamptz(L.updated_at);
  await client.query(
    `INSERT INTO listings (
      id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
      inventory_bypass_on, ops_tag, category, description, meta_fields,
      img_hd, img_white, img_wdim, img_link1, img_link2, no_of_constituents,
      actual_weight, dimension, bulk_price, keyword_pool, material_info,
      available_quantity, raw_created_at, raw_updated_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, NOW()
    )
    ON CONFLICT (sku_id) DO UPDATE SET
      id = EXCLUDED.id,
      master_sku = EXCLUDED.master_sku,
      inventory_sku_id = EXCLUDED.inventory_sku_id,
      pack_combo_sku_id = EXCLUDED.pack_combo_sku_id,
      sku_type = EXCLUDED.sku_type,
      inventory_bypass_on = EXCLUDED.inventory_bypass_on,
      ops_tag = EXCLUDED.ops_tag,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      meta_fields = EXCLUDED.meta_fields,
      img_hd = EXCLUDED.img_hd,
      img_white = EXCLUDED.img_white,
      img_wdim = EXCLUDED.img_wdim,
      img_link1 = EXCLUDED.img_link1,
      img_link2 = EXCLUDED.img_link2,
      no_of_constituents = EXCLUDED.no_of_constituents,
      actual_weight = EXCLUDED.actual_weight,
      dimension = EXCLUDED.dimension,
      bulk_price = EXCLUDED.bulk_price,
      keyword_pool = EXCLUDED.keyword_pool,
      material_info = EXCLUDED.material_info,
      available_quantity = EXCLUDED.available_quantity,
      raw_created_at = EXCLUDED.raw_created_at,
      raw_updated_at = EXCLUDED.raw_updated_at,
      updated_at = NOW()`,
    [
      lid,
      String(L.sku_id),
      L.master_sku != null ? String(L.master_sku) : null,
      L.inventory_sku_id != null ? String(L.inventory_sku_id) : null,
      L.pack_combo_sku_id != null ? String(L.pack_combo_sku_id) : null,
      L.sku_type != null ? String(L.sku_type) : null,
      L.inventory_bypass_on != null ? String(L.inventory_bypass_on) : null,
      L.ops_tag != null ? String(L.ops_tag) : null,
      L.category != null ? String(L.category) : null,
      L.description != null ? String(L.description) : null,
      L.meta_fields != null ? String(L.meta_fields) : null,
      L.img_hd != null ? String(L.img_hd) : null,
      L.img_white != null ? String(L.img_white) : null,
      L.img_wdim != null ? String(L.img_wdim) : null,
      L.img_link1 != null ? String(L.img_link1) : null,
      L.img_link2 != null ? String(L.img_link2) : null,
      num(L.no_of_constituents, 1),
      num(L.actual_weight, 0),
      L.dimension != null ? String(L.dimension) : null,
      num(L.bulk_price, null),
      L.keyword_pool != null ? String(L.keyword_pool) : null,
      L.material_info != null ? String(L.material_info) : null,
      num(L.available_quantity, 0) ?? 0,
      rawCreated,
      rawUpdated,
    ]
  );
}

export async function upsertBin(client, b) {
  const bid = num(b.id);
  const wid = num(b.warehouse_id);
  if (bid == null || wid == null || b.sku_id == null || b.bin_id == null) return;
  const skuId = String(b.sku_id);
  const binId = String(b.bin_id);
  const isDel = boolDeleted(b.is_deleted);
  await client.query(
    `DELETE FROM bins
     WHERE id = $1
       AND NOT (warehouse_id = $2 AND sku_id = $3 AND bin_id = $4)`,
    [bid, wid, skuId, binId]
  );
  await client.query(
    `INSERT INTO bins (
      id, warehouse_id, sku_id, bin_id, available_quantity, is_deleted, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (warehouse_id, sku_id, bin_id) DO UPDATE SET
      id = EXCLUDED.id,
      available_quantity = EXCLUDED.available_quantity,
      is_deleted = EXCLUDED.is_deleted,
      updated_at = NOW()`,
    [bid, wid, skuId, binId, num(b.available_quantity, 0) ?? 0, isDel]
  );
}

export async function upsertVendor(client, v) {
  await client.query(
    `INSERT INTO vendors (
      id, vendor_name, created_by, modified_by, created_at, updated_at,
      vendor_address_line, vendor_city, vendor_state, vendor_postal_code,
      vendor_gstin, vendor_contact_number
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      vendor_name = EXCLUDED.vendor_name,
      created_by = EXCLUDED.created_by,
      modified_by = EXCLUDED.modified_by,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      vendor_address_line = EXCLUDED.vendor_address_line,
      vendor_city = EXCLUDED.vendor_city,
      vendor_state = EXCLUDED.vendor_state,
      vendor_postal_code = EXCLUDED.vendor_postal_code,
      vendor_gstin = EXCLUDED.vendor_gstin,
      vendor_contact_number = EXCLUDED.vendor_contact_number`,
    [
      num(v.id),
      v.vendor_name != null ? String(v.vendor_name) : null,
      v.created_by != null ? String(v.created_by) : null,
      v.modified_by != null ? String(v.modified_by) : null,
      parseTimestamptz(v.created_at),
      parseTimestamptz(v.updated_at),
      v.vendor_address_line != null ? String(v.vendor_address_line) : null,
      v.vendor_city != null ? String(v.vendor_city) : null,
      v.vendor_state != null ? String(v.vendor_state) : null,
      v.vendor_postal_code != null ? String(v.vendor_postal_code) : null,
      v.vendor_gstin != null ? String(v.vendor_gstin) : null,
      v.vendor_contact_number != null ? String(v.vendor_contact_number) : null,
    ]
  );
}

export async function upsertSpecialty(client, s) {
  await client.query(
    `INSERT INTO vendor_specialties (
      id, vendor_id, vendor_speciality, created_by, modified_by, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      vendor_id = EXCLUDED.vendor_id,
      vendor_speciality = EXCLUDED.vendor_speciality,
      created_by = EXCLUDED.created_by,
      modified_by = EXCLUDED.modified_by,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at`,
    [
      num(s.id),
      num(s.vendor_id),
      s.vendor_speciality != null ? String(s.vendor_speciality) : null,
      s.created_by != null ? String(s.created_by) : null,
      s.modified_by != null ? String(s.modified_by) : null,
      parseTimestamptz(s.created_at),
      parseTimestamptz(s.updated_at),
    ]
  );
}

export async function upsertVendorSku(client, row) {
  await client.query(
    `INSERT INTO vendor_sku (
      id, vendor_id, sku_id, cost_price, modified_by, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (vendor_id, sku_id) DO UPDATE SET
      id = EXCLUDED.id,
      cost_price = EXCLUDED.cost_price,
      modified_by = EXCLUDED.modified_by,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at`,
    [
      num(row.id),
      num(row.vendor_id),
      String(row.sku_id),
      num(row.cost_price, 0) ?? 0,
      row.modified_by != null ? String(row.modified_by) : null,
      parseTimestamptz(row.created_at),
      parseTimestamptz(row.updated_at),
    ]
  );
}

/**
 * Run vendor + listings upserts inside an open transaction (caller BEGIN/COMMIT).
 * @returns {{ skipped: number, warehouseCount: number, listingRowCount: number, specsCount: number }}
 */
export async function executeVendorSync(client, vendor, listingRows) {
  const warehouseIds = collectWarehouseIds(listingRows);
  for (const wid of warehouseIds) {
    await upsertWarehouse(client, wid);
  }

  for (const item of listingRows) {
    const L = item?.listing;
    if (L) await upsertListing(client, L);
  }

  for (const item of listingRows) {
    const L = item?.listing;
    if (!L?.bins) continue;
    if (!L.sku_id || num(L.id) == null) continue;
    for (const b of L.bins) {
      await upsertBin(client, { ...b, sku_id: L.sku_id });
    }
  }

  await upsertVendor(client, vendor);

  const specs = Array.isArray(vendor.specialties) ? vendor.specialties : [];
  for (const s of specs) {
    await upsertSpecialty(client, s);
  }

  let skipped = 0;
  for (const item of listingRows) {
    if (!item?.sku_id || !item?.vendor_id) {
      skipped += 1;
      continue;
    }
    const L = item.listing;
    if (!L?.sku_id) {
      skipped += 1;
      continue;
    }
    await upsertVendorSku(client, item);
  }

  return {
    skipped,
    warehouseCount: warehouseIds.size,
    listingRowCount: listingRows.length,
    specsCount: specs.length,
  };
}
