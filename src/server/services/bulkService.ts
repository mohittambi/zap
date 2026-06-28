// @ts-nocheck
import { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { isBulkRowEmpty, mapBulkRowToCreateListingInput } from "@/lib/listingCreate";
import { createListing } from "@/server/services/listingsService";

function csvEscape(v) {
  if (v == null) return "";
  if (v instanceof Date) return csvEscape(v.toISOString());
  if (typeof v === "object") return csvEscape(JSON.stringify(v));
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export async function exportSecondaryListingsCsv() {
  const r = await query(
    `SELECT id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_status, ais_quantity, available_quantity,
            company_details, labels_data, sku_wise_details_raw, synced_at
     FROM secondary_listings ORDER BY id`
  );
  const headers = [
    "id",
    "secondary_sku",
    "master_sku",
    "inventory_sku_id",
    "pack_combo_sku_id",
    "sku_type",
    "inventory_bypass_status",
    "ais_quantity",
    "available_quantity",
    "company_details",
    "labels_data",
    "sku_wise_details_raw",
    "synced_at",
  ];
  return rowsToCsv(
    headers,
    r.rows.map((x) => headers.map((h) => x[h]))
  );
}

export async function exportPacksCombosCsv() {
  const r = await query(
    `SELECT id, parent_sku_id, component_sku_id, quantity FROM pack_combos ORDER BY parent_sku_id, id`
  );
  const headers = ["id", "parent_sku_id", "component_sku_id", "quantity"];
  return rowsToCsv(
    headers,
    r.rows.map((x) => headers.map((h) => x[h]))
  );
}

export async function exportAisListingsCsv() {
  const r = await query(
    `SELECT id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_status, ais_quantity, available_quantity,
            company_details, labels_data, synced_at
     FROM secondary_listings
     WHERE ais_quantity IS NOT NULL AND ais_quantity > 0
     ORDER BY id`
  );
  const headers = [
    "id",
    "secondary_sku",
    "master_sku",
    "inventory_sku_id",
    "pack_combo_sku_id",
    "sku_type",
    "inventory_bypass_status",
    "ais_quantity",
    "available_quantity",
    "company_details",
    "labels_data",
    "synced_at",
  ];
  return rowsToCsv(
    headers,
    r.rows.map((x) => headers.map((h) => x[h]))
  );
}

export async function exportMasterSkuCsv() {
  const r = await query(
    `SELECT id, sku_id, master_sku, inventory_sku_id, pack_combo_sku_id, sku_type,
            inventory_bypass_on, ops_tag, category, description, meta_fields,
            img_hd, img_white, img_wdim, img_link1, img_link2,
            no_of_constituents, actual_weight, dimension, bulk_price, keyword_pool, material_info,
            available_quantity, raw_created_at, raw_updated_at, eautomate_bins AS bins
     FROM listings ORDER BY sku_id`
  );
  const headers = [
    "id",
    "sku_id",
    "master_sku",
    "inventory_sku_id",
    "pack_combo_sku_id",
    "sku_type",
    "inventory_bypass_on",
    "ops_tag",
    "category",
    "description",
    "meta_fields",
    "img_hd",
    "img_white",
    "img_wdim",
    "img_link1",
    "img_link2",
    "no_of_constituents",
    "actual_weight",
    "dimension",
    "bulk_price",
    "keyword_pool",
    "material_info",
    "available_quantity",
    "raw_created_at",
    "raw_updated_at",
    "bins",
  ];
  return rowsToCsv(
    headers,
    r.rows.map((x) => headers.map((h) => x[h]))
  );
}

/** @param {Buffer} buffer */
export async function importSecondaryListingsFromBuffer(buffer) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const errors = [];
  let imported = 0;
  const maxR = await query(
    `SELECT COALESCE(MAX(id),0)::bigint AS m FROM secondary_listings`
  );
  let nextId = BigInt(maxR.rows[0].m);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const secondary_sku = String(
      r.secondary_sku ?? r.SecondarySKU ?? ""
    ).trim();
    if (!secondary_sku) {
      errors.push({ row: i + 2, message: "missing secondary_sku" });
      continue;
    }
    try {
      const ex = await query(
        `SELECT id FROM secondary_listings WHERE secondary_sku = $1`,
        [secondary_sku]
      );
      const master_sku = r.master_sku ?? r.MasterSKU ?? null;
      const inventory_sku_id = r.inventory_sku_id ?? r["Inventory SKU"] ?? null;
      const pack_combo_sku_id = r.pack_combo_sku_id ?? r["Pack Combo SKU"] ?? null;
      const sku_type = r.sku_type ?? r["SKU Type"] ?? "SINGLE";
      const inventory_bypass_status =
        r.inventory_bypass_status ?? r["Bypass Status"] ?? "OFF";
      const ais_quantity = Number(r.ais_quantity ?? r["Platform Stock"] ?? 0);
      const available_quantity = Number(
        r.available_quantity ?? r["Warehouse Stock"] ?? 0
      );
      if (ex.rows.length) {
        await query(
          `UPDATE secondary_listings SET
             master_sku = $2, inventory_sku_id = $3, pack_combo_sku_id = $4,
             sku_type = $5, inventory_bypass_status = $6, ais_quantity = $7, available_quantity = $8
           WHERE secondary_sku = $1`,
          [
            secondary_sku,
            master_sku,
            inventory_sku_id,
            pack_combo_sku_id,
            sku_type,
            inventory_bypass_status,
            ais_quantity,
            available_quantity,
          ]
        );
      } else {
        nextId += 1n;
        await query(
          `INSERT INTO secondary_listings (
             id, secondary_sku, master_sku, inventory_sku_id, pack_combo_sku_id,
             sku_type, inventory_bypass_status, ais_quantity, available_quantity
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            nextId.toString(),
            secondary_sku,
            master_sku,
            inventory_sku_id,
            pack_combo_sku_id,
            sku_type,
            inventory_bypass_status,
            ais_quantity,
            available_quantity,
          ]
        );
      }
      imported++;
    } catch (e) {
      errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { imported, errors };
}

/** @param {Buffer} buffer */
export async function importPacksCombosFromBuffer(buffer) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const errors = [];
  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const parent_sku_id = String(
      r.parent_sku_id ?? r["Bundle SKU (Parent)"] ?? ""
    ).trim();
    const component_sku_id = String(
      r.component_sku_id ?? r["Component SKU"] ?? ""
    ).trim();
    const qty = Number(r.quantity ?? r["Component Quantity"] ?? 1);
    if (!parent_sku_id || !component_sku_id) {
      errors.push({ row: i + 2, message: "missing parent or component sku" });
      continue;
    }
    try {
      const ex = await query(
        `SELECT id FROM pack_combos WHERE parent_sku_id = $1 AND component_sku_id = $2`,
        [parent_sku_id, component_sku_id]
      );
      if (ex.rows.length) {
        await query(
          `UPDATE pack_combos SET quantity = $3 WHERE parent_sku_id = $1 AND component_sku_id = $2`,
          [parent_sku_id, component_sku_id, qty]
        );
      } else {
        await query(
          `INSERT INTO pack_combos (parent_sku_id, component_sku_id, quantity)
           VALUES ($1, $2, $3)`,
          [parent_sku_id, component_sku_id, qty]
        );
      }
      imported++;
    } catch (e) {
      errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { imported, errors };
}

/** AIS = same as secondary import with optional filter — reuse secondary listings sheet format */
export async function importAisListingsFromBuffer(buffer) {
  return importSecondaryListingsFromBuffer(buffer);
}

/** Create new master listings from CSV/XLSX (create-only; existing sku_id → row error). */
export async function importMasterListingsFromBuffer(buffer, createdBy) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  const errors = [];
  let imported = 0;
  const createdSkuIds = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isBulkRowEmpty(r)) continue;

    try {
      const body = mapBulkRowToCreateListingInput(r);
      const listing = await createListing(body, createdBy);
      imported++;
      createdSkuIds.push(listing.sku_id);
    } catch (e) {
      const message =
        e instanceof AppError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      errors.push({ row: i + 2, message });
    }
  }

  return { imported, errors, created_sku_ids: createdSkuIds };
}
