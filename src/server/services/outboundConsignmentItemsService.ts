import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import { logConsignmentActivityFromZap } from "@/server/services/outboundPoLogsService";
import { rollupPoPackedQuantitiesFromConsignments } from "@/server/services/outboundConsignmentPoLineItemsService";
import type {
  ConsignmentLineDraft,
  ConsignmentSkuPacking,
} from "@/lib/outbound-consignment-line-drafts";
import {
  extractConsignmentSkuPackingFromListings,
  flattenSkuPackingToLineRows,
  groupLineRowsToSkuPacking,
  validateConsignmentSkuPackingClient,
} from "@/lib/outbound-consignment-line-drafts";
import {
  batchGetZapEanByCompany,
  enrichListingsSnapshotWithZapEan,
  enrichRowsWithZapEan,
  mappingSkuKeysFromRow,
  resolveZapEanDisplay,
  type ZapEanLookup,
} from "@/server/services/eanMappingsService";
import { getOutboundPurchaseOrderByPoNumber } from "@/server/services/outboundPurchaseOrdersService";
import { groupPackingRowsByBin } from "@/server/utils/outboundConsignmentPackingSpreadsheetParse";

function pickFirst(
  obj: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function pickStr(
  obj: Record<string, unknown>,
  keys: string[],
  maxLen?: number
): string | null {
  const v = pickFirst(obj, keys);
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return maxLen != null ? s.slice(0, maxLen) : s;
}

function pickInt(obj: Record<string, unknown>, keys: string[]): number | null {
  const v = pickFirst(obj, keys);
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function pickNumStr(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  const v = pickFirst(obj, keys);
  if (v == null || v === "") return null;
  return String(v).trim() || null;
}

function parseTs(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * eAutomate listing row → consignment line item columns (unknown keys stay in `raw`).
 */
export function mapListingRowToItemColumns(
  row: Record<string, unknown>,
  poNumberFallback: string | null
): {
  po_number: string | null;
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  company_code_secondary: string | null;
  box_number: number | null;
  box_quantity: number | null;
  box_name: string | null;
  submitted_from: string | null;
  mrp: string | null;
  original_demand: number | null;
  dispatched_quantity: number | null;
  consignment_quantity: number | null;
  overall_fill_rate: string | null;
  created_by: string | null;
  created_at_ea: string | null;
  updated_at_ea: string | null;
  rawJson: string;
} {
  const normalized = { ...row };
  const po_number =
    pickStr(
      normalized,
      [
        "po_number",
        "poNumber",
        "purchase_order_number",
        "purchaseOrderNumber",
      ],
      80
    ) ?? (poNumberFallback ? poNumberFallback.slice(0, 80) : null);

  return {
    po_number,
    po_secondary_sku: pickStr(
      normalized,
      [
        "po_secondary_sku",
        "poSecondarySku",
        "secondary_sku",
        "secondarySku",
        "poSecondarySKU",
      ],
      120
    ),
    company_code_primary: pickStr(
      normalized,
      [
        "company_code_primary",
        "companyCodePrimary",
        "primary_company_code",
        "primaryCompanyCode",
        "ean",
      ],
      120
    ),
    company_code_secondary: pickStr(
      normalized,
      [
        "company_code_secondary",
        "companyCodeSecondary",
        "secondary_company_code",
        "barcode",
        "upc",
      ],
      120
    ),
    box_number: pickInt(normalized, [
      "box_number",
      "boxNumber",
      "box_no",
      "boxNo",
    ]),
    box_quantity: pickInt(normalized, [
      "box_quantity",
      "boxQuantity",
      "quantity",
    ]),
    box_name: pickStr(
      normalized,
      ["box_name", "boxName", "box_type", "boxType"],
      120
    ),
    submitted_from: pickStr(
      normalized,
      ["submitted_from", "submittedFrom", "source"],
      80
    ),
    mrp: pickNumStr(normalized, ["mrp", "MRP", "max_retail_price", "maxRetailPrice"]),
    original_demand: pickInt(normalized, [
      "original_demand",
      "originalDemand",
      "demand",
      "demand_quantity",
    ]),
    dispatched_quantity: pickInt(normalized, [
      "dispatched_quantity",
      "dispatchedQuantity",
    ]),
    consignment_quantity: pickInt(normalized, [
      "consignment_quantity",
      "consignmentQuantity",
    ]),
    overall_fill_rate: pickNumStr(normalized, [
      "overall_fill_rate",
      "overallFillRate",
      "fill_rate",
      "fillRate",
    ]),
    created_by: pickStr(
      normalized,
      ["created_by", "createdBy", "submitted_by", "submittedBy"],
      120
    ),
    created_at_ea: parseTs(
      pickFirst(normalized, [
        "created_at",
        "createdAt",
        "consignment_item_created_at",
      ])
    ),
    updated_at_ea: parseTs(
      pickFirst(normalized, [
        "updated_at",
        "updatedAt",
        "modified_at",
        "modifiedAt",
      ])
    ),
    rawJson: JSON.stringify(row),
  };
}

/** Consignment id on a listing row, if present. */
export function pickConsignmentIdFromListingRow(
  row: Record<string, unknown>
): number | null {
  return pickInt(row, [
    "consignment_id",
    "consignmentId",
    "incoming_purchase_order_consignment_id",
    "incomingPurchaseOrderConsignmentId",
    "consignmentID",
  ]);
}

/**
 * When the API includes consignment_id on lines, keep only lines for this consignment.
 * If no row has a consignment id, return all rows (single-consignment / legacy shape).
 */
export function filterListingRowsForConsignment(
  rows: Record<string, unknown>[],
  consignmentId: number
): Record<string, unknown>[] {
  const anyId = rows.some(
    (r) => pickConsignmentIdFromListingRow(r) != null
  );
  if (anyId) {
    return rows.filter(
      (r) => pickConsignmentIdFromListingRow(r) === consignmentId
    );
  }
  return rows;
}

export async function replaceConsignmentItems(
  consignmentId: number,
  rows: Record<string, unknown>[],
  poNumberFallback: string | null
): Promise<number> {
  if (!Number.isFinite(consignmentId) || consignmentId < 1) return 0;

  const pool = getPool();
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM outbound_consignment_items WHERE consignment_id = $1`,
      [consignmentId]
    );

    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const m = mapListingRowToItemColumns(
        row as Record<string, unknown>,
        poNumberFallback
      );
      await client.query(
        `INSERT INTO outbound_consignment_items (
          consignment_id, po_number, po_secondary_sku, company_code_primary, company_code_secondary,
          box_number, box_quantity, box_name, submitted_from, mrp, original_demand,
          dispatched_quantity, consignment_quantity, overall_fill_rate, created_by,
          created_at_ea, updated_at_ea, raw, synced_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::numeric, $11, $12, $13, $14::numeric, $15, $16::timestamptz, $17::timestamptz, $18::jsonb, NOW()
        )`,
        [
          consignmentId,
          m.po_number,
          m.po_secondary_sku,
          m.company_code_primary,
          m.company_code_secondary,
          m.box_number,
          m.box_quantity,
          m.box_name,
          m.submitted_from,
          m.mrp,
          m.original_demand,
          m.dispatched_quantity,
          m.consignment_quantity,
          m.overall_fill_rate,
          m.created_by,
          m.created_at_ea,
          m.updated_at_ea,
          m.rawJson,
        ]
      );
      inserted += 1;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

export async function upsertTransporterDetails(
  rows: unknown[]
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    if (row == null) continue;
    if (typeof row === "object" && !Array.isArray(row)) {
      const o = row as Record<string, unknown>;
      const id = pickInt(o, [
        "id",
        "transporter_id",
        "transporterId",
        "transporterID",
      ]);
      if (id == null || id < 1) continue;
      const name =
        pickStr(
          o,
          [
            "name",
            "transporter_name",
            "transporterName",
            "label",
            "title",
          ],
          300
        ) ?? null;
      const rawJson = JSON.stringify(o);
      await query(
        `INSERT INTO outbound_transporter_details (id, name, raw, synced_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           raw = EXCLUDED.raw,
           synced_at = NOW()`,
        [id, name, rawJson]
      );
      n += 1;
    }
  }
  return n;
}

function validBoxNameFromRow(row: unknown): { name: string; raw: string } | null {
  if (row == null) return null;
  if (typeof row === "string") {
    const name = row.trim().slice(0, 300);
    if (!name) return null;
    return { name, raw: JSON.stringify({ value: row }) };
  }
  if (typeof row === "object" && !Array.isArray(row)) {
    const o = row as Record<string, unknown>;
    const name = pickStr(
      o,
      [
        "name",
        "box_name",
        "boxName",
        "label",
        "value",
        "title",
      ],
      300
    );
    if (!name) return null;
    return { name, raw: JSON.stringify(o) };
  }
  return null;
}

export async function upsertValidBoxNames(rows: unknown[]): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const parsed = validBoxNameFromRow(row);
    if (!parsed) continue;
    await query(
      `INSERT INTO outbound_valid_box_names (name, raw, synced_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (name) DO UPDATE SET
         raw = EXCLUDED.raw,
         synced_at = NOW()`,
      [parsed.name, parsed.raw]
    );
    n += 1;
  }
  return n;
}

export async function updateConsignmentDetailRaw(
  consignmentId: number,
  detailRaw: unknown
): Promise<void> {
  if (!Number.isFinite(consignmentId) || consignmentId < 1) return;
  let json: string;
  if (detailRaw && typeof detailRaw === "object") {
    json = JSON.stringify(detailRaw);
  } else if (detailRaw == null) {
    json = "{}";
  } else {
    json = JSON.stringify({ value: detailRaw });
  }
  await query(
    `UPDATE outbound_consignments
     SET detail_raw = $2::jsonb, detail_synced_at = NOW()
     WHERE id = $1`,
    [consignmentId, json]
  );
}

/** All consignment ids and PO numbers for sync iteration. */
export async function listOutboundConsignmentIdsForSync(): Promise<
  { id: number; po_number: string | null }[]
> {
  const r = await query(
    `SELECT id, po_number FROM outbound_consignments ORDER BY id ASC`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    po_number:
      row.po_number != null && String(row.po_number).trim()
        ? String(row.po_number).trim()
        : null,
  }));
}

export type OutboundConsignmentItemRow = {
  consignment_id: number;
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  company_code_secondary: string | null;
  box_number: number | null;
  box_name: string | null;
  box_quantity: number | null;
  mrp: number | null;
  original_demand: number | null;
  dispatched_quantity: number | null;
  consignment_quantity: number | null;
  overall_fill_rate: number | null;
};

/** Line items by PO number for local Phase-1 box-label CSV generation. */
export async function getOutboundConsignmentItemsByPoNumber(
  poNumber: string
): Promise<OutboundConsignmentItemRow[]> {
  const pn = String(poNumber || "").trim();
  if (!pn) return [];
  const r = await query(
    `SELECT consignment_id, po_secondary_sku, company_code_primary, company_code_secondary,
            box_number, box_name, box_quantity, mrp, original_demand,
            dispatched_quantity, consignment_quantity, overall_fill_rate
       FROM outbound_consignment_items
      WHERE po_number = $1
      ORDER BY consignment_id ASC, box_number ASC NULLS LAST, id ASC`,
    [pn]
  );
  return r.rows.map((row) => ({
    consignment_id: Number(row.consignment_id),
    po_secondary_sku:
      row.po_secondary_sku != null ? String(row.po_secondary_sku) : null,
    company_code_primary:
      row.company_code_primary != null ? String(row.company_code_primary) : null,
    company_code_secondary:
      row.company_code_secondary != null ? String(row.company_code_secondary) : null,
    box_number: row.box_number != null ? Number(row.box_number) : null,
    box_name: row.box_name != null ? String(row.box_name) : null,
    box_quantity: row.box_quantity != null ? Number(row.box_quantity) : null,
    mrp: row.mrp != null ? Number(row.mrp) : null,
    original_demand:
      row.original_demand != null ? Number(row.original_demand) : null,
    dispatched_quantity:
      row.dispatched_quantity != null ? Number(row.dispatched_quantity) : null,
    consignment_quantity:
      row.consignment_quantity != null ? Number(row.consignment_quantity) : null,
    overall_fill_rate:
      row.overall_fill_rate != null ? Number(row.overall_fill_rate) : null,
  }));
}

/**
 * SKU-level rows for the SKU report CSV, deduped by `po_secondary_sku`.
 * Reads columns + `raw` JSONB so the report can include demand, rates, HSN, listing fields, etc.
 * The `raw` field mirrors the eAutomate `/listings/paginated` row shape — richest available source.
 */
export type SkuReportItemRow = {
  po_secondary_sku: string | null;
  company_code_primary: string | null;
  company_code_secondary: string | null;
  mrp: number | null;
  original_demand: number | null;
  dispatched_quantity: number | null;
  consignment_quantity: number | null;
  overall_fill_rate: number | null;
  raw: Record<string, unknown>;
};

export type ProductLabelRow = {
  po_secondary_sku: string;
  company_code_primary: string;
  company_code_secondary: string;
  ean_code: string;
  zap_ean: string;
  universal_ean: string;
  size: string;
  color: string;
  one_set_contains: string;
  material: string;
  mrp_now: string;
  mrp_at_po_creation: string;
  img_url: string;
  master_sku: string;
  inventory_sku_id: string;
  pack_combo_sku_id: string;
  sku_type: string;
  title: string;
  warehouse_quantity: string;
  demand_quantity: string;
  dispatched_quantity: string;
};

function applyZapEanToLabelRow(
  base: Omit<ProductLabelRow, "zap_ean" | "universal_ean">,
  lookup: Map<string, ZapEanLookup>
): ProductLabelRow {
  const keys = mappingSkuKeysFromRow({
    master_sku: base.master_sku,
    inventory_sku_id: base.inventory_sku_id,
  });
  let hit: ZapEanLookup | undefined;
  for (const k of keys) {
    hit = lookup.get(k);
    if (hit) break;
  }
  return {
    ...base,
    zap_ean: resolveZapEanDisplay(base.company_code_primary, hit),
    universal_ean: hit?.universal_ean ?? "",
  };
}

export async function getProductLabelRowsByPoNumber(
  poNumber: string,
  companyId?: number | null
): Promise<ProductLabelRow[]> {
  const pn = String(poNumber || "").trim();
  if (!pn) return [];
  const r = await query(
    `SELECT DISTINCT ON (ci.po_secondary_sku)
            ci.po_secondary_sku,
            ci.company_code_primary,
            ci.company_code_secondary,
            ci.mrp AS mrp_at_po_creation,
            ci.raw,
            COALESCE(lm.ean_code, '')        AS ean_code,
            COALESCE(lm.size, '')            AS size,
            COALESCE(lm.color, '')           AS color,
            COALESCE(lm.one_set_contains, '') AS one_set_contains,
            COALESCE(lm.material, '')        AS material,
            COALESCE(lm.mrp::text, '')       AS mrp_now,
            po.company_id
       FROM outbound_consignment_items ci
       LEFT JOIN labels_master_data lm ON lm.secondary_sku = ci.po_secondary_sku
       LEFT JOIN outbound_purchase_orders po
         ON TRIM(COALESCE(po.po_number, '')) = TRIM(COALESCE(ci.po_number, ''))
      WHERE ci.po_number = $1
      ORDER BY ci.po_secondary_sku ASC, ci.id ASC`,
    [pn]
  );
  const resolvedCompanyId =
    companyId != null && companyId > 0
      ? companyId
      : r.rows[0]?.company_id != null
        ? Number(r.rows[0].company_id)
        : null;

  const mapped = r.rows.map((row) => {
    const raw =
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? (row.raw as Record<string, unknown>)
        : {};
    const rawListing =
      raw.listing && typeof raw.listing === "object" && !Array.isArray(raw.listing)
        ? (raw.listing as Record<string, unknown>)
        : {};
    return {
      po_secondary_sku: row.po_secondary_sku != null ? String(row.po_secondary_sku) : "",
      company_code_primary:
        row.company_code_primary != null ? String(row.company_code_primary) : "",
      company_code_secondary:
        row.company_code_secondary != null ? String(row.company_code_secondary) : "",
      ean_code: String(row.ean_code ?? ""),
      size: String(row.size ?? ""),
      color: String(row.color ?? ""),
      one_set_contains: String(row.one_set_contains ?? ""),
      material: String(row.material ?? ""),
      mrp_now: String(row.mrp_now ?? ""),
      mrp_at_po_creation:
        row.mrp_at_po_creation != null ? String(row.mrp_at_po_creation) : "",
      img_url:
        rawListing.img_hd != null
          ? String(rawListing.img_hd)
          : rawListing.img_wdim != null
            ? String(rawListing.img_wdim)
            : rawListing.img_white != null
              ? String(rawListing.img_white)
              : "",
      master_sku:
        raw.master_sku != null
          ? String(raw.master_sku)
          : rawListing.master_sku != null
            ? String(rawListing.master_sku)
            : "",
      inventory_sku_id:
        raw.inventory_sku_id != null
          ? String(raw.inventory_sku_id)
          : rawListing.inventory_sku_id != null
            ? String(rawListing.inventory_sku_id)
            : "",
      pack_combo_sku_id:
        raw.pack_combo_sku_id != null
          ? String(raw.pack_combo_sku_id)
          : rawListing.pack_combo_sku_id != null
            ? String(rawListing.pack_combo_sku_id)
            : "",
      sku_type:
        raw.sku_type != null
          ? String(raw.sku_type)
          : rawListing.sku_type != null
            ? String(rawListing.sku_type)
            : "",
      title: raw.title != null ? String(raw.title) : "",
      warehouse_quantity:
        rawListing.available_quantity != null ? String(rawListing.available_quantity) : "",
      demand_quantity: raw.demand != null ? String(raw.demand) : "",
      dispatched_quantity:
        raw.dispatched_quantity != null ? String(raw.dispatched_quantity) : "",
    };
  });

  const skuCodes = mapped.flatMap((m) =>
    mappingSkuKeysFromRow({ master_sku: m.master_sku, inventory_sku_id: m.inventory_sku_id })
  );
  const lookup = await batchGetZapEanByCompany({
    company_id: resolvedCompanyId,
    sku_codes: skuCodes,
  });
  return mapped.map((m) => applyZapEanToLabelRow(m, lookup));
}

/**
 * Build ProductLabelRow[] from a `listings_snapshot` content array.
 * Used as fallback when `outbound_consignment_items` has no rows for the PO.
 * Enriches with `labels_master_data` where available; fills from snapshot fields otherwise.
 */
export async function getProductLabelRowsFromSnapshot(
  snapshotRows: Record<string, unknown>[],
  companyId?: number | null
): Promise<ProductLabelRow[]> {
  if (snapshotRows.length === 0) return [];

  const skus = snapshotRows
    .map((r) => (r.po_secondary_sku != null ? String(r.po_secondary_sku) : ""))
    .filter(Boolean);

  // Batch-fetch labels_master_data for these SKUs
  const lmResult =
    skus.length > 0
      ? await query(
          `SELECT secondary_sku, ean_code, size, color, one_set_contains, material, mrp
             FROM labels_master_data
            WHERE secondary_sku = ANY($1)`,
          [skus]
        )
      : { rows: [] };

  const lmMap = new Map<string, Record<string, unknown>>();
  for (const row of lmResult.rows) {
    lmMap.set(String(row.secondary_sku), row as Record<string, unknown>);
  }

  const seen = new Set<string>();
  const baseRows: Omit<ProductLabelRow, "zap_ean" | "universal_ean">[] = [];
  for (const item of snapshotRows) {
    const sku = item.po_secondary_sku != null ? String(item.po_secondary_sku) : "";
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);

    const lm = lmMap.get(sku);
    const listing =
      item.listing && typeof item.listing === "object" && !Array.isArray(item.listing)
        ? (item.listing as Record<string, unknown>)
        : {};

    // Size: prefer labels_master_data, then first segment of listing.dimension
    const dimFull = listing.dimension != null ? String(listing.dimension) : "";
    const dimShort = dimFull.split(" / ")[0]?.trim() ?? "";

    baseRows.push({
      po_secondary_sku: sku,
      company_code_primary:
        item.company_code_primary != null ? String(item.company_code_primary) : "",
      company_code_secondary:
        item.company_code_secondary != null ? String(item.company_code_secondary) : "",
      ean_code: lm?.ean_code != null ? String(lm.ean_code) : "",
      size: lm?.size != null ? String(lm.size) : dimShort,
      color:
        lm?.color != null
          ? String(lm.color)
          : item.color != null
            ? String(item.color)
            : "",
      one_set_contains: lm?.one_set_contains != null ? String(lm.one_set_contains) : "",
      material:
        lm?.material != null
          ? String(lm.material)
          : listing.material_info != null
            ? String(listing.material_info)
            : "",
      mrp_now:
        lm?.mrp != null
          ? String(lm.mrp)
          : item.mrp != null
            ? String(item.mrp)
            : "",
      mrp_at_po_creation: item.mrp != null ? String(item.mrp) : "",
      img_url:
        listing.img_hd != null
          ? String(listing.img_hd)
          : listing.img_wdim != null
            ? String(listing.img_wdim)
            : listing.img_white != null
              ? String(listing.img_white)
              : "",
      master_sku:
        item.master_sku != null
          ? String(item.master_sku)
          : listing.master_sku != null
            ? String(listing.master_sku)
            : "",
      inventory_sku_id:
        item.inventory_sku_id != null
          ? String(item.inventory_sku_id)
          : listing.inventory_sku_id != null
            ? String(listing.inventory_sku_id)
            : "",
      pack_combo_sku_id:
        item.pack_combo_sku_id != null
          ? String(item.pack_combo_sku_id)
          : listing.pack_combo_sku_id != null
            ? String(listing.pack_combo_sku_id)
            : "",
      sku_type:
        item.sku_type != null
          ? String(item.sku_type)
          : listing.sku_type != null
            ? String(listing.sku_type)
            : "",
      title: item.title != null ? String(item.title) : "",
      warehouse_quantity:
        listing.available_quantity != null ? String(listing.available_quantity) : "",
      demand_quantity: item.demand != null ? String(item.demand) : "",
      dispatched_quantity:
        item.dispatched_quantity != null ? String(item.dispatched_quantity) : "",
    });
  }
  const skuCodes = baseRows.flatMap((m) =>
    mappingSkuKeysFromRow({ master_sku: m.master_sku, inventory_sku_id: m.inventory_sku_id })
  );
  const lookup = await batchGetZapEanByCompany({
    company_id: companyId,
    sku_codes: skuCodes,
  });
  return baseRows.map((m) => applyZapEanToLabelRow(m, lookup));
}

export async function getSkuReportItemsByPoNumber(
  poNumber: string
): Promise<SkuReportItemRow[]> {
  const pn = String(poNumber || "").trim();
  if (!pn) return [];
  const r = await query(
    `SELECT DISTINCT ON (po_secondary_sku)
            po_secondary_sku, company_code_primary, company_code_secondary,
            mrp, original_demand, dispatched_quantity, consignment_quantity,
            overall_fill_rate, raw
       FROM outbound_consignment_items
      WHERE po_number = $1
      ORDER BY po_secondary_sku ASC, id ASC`,
    [pn]
  );
  return r.rows.map((row) => ({
    po_secondary_sku:
      row.po_secondary_sku != null ? String(row.po_secondary_sku) : null,
    company_code_primary:
      row.company_code_primary != null ? String(row.company_code_primary) : null,
    company_code_secondary:
      row.company_code_secondary != null ? String(row.company_code_secondary) : null,
    mrp: row.mrp != null ? Number(row.mrp) : null,
    original_demand:
      row.original_demand != null ? Number(row.original_demand) : null,
    dispatched_quantity:
      row.dispatched_quantity != null ? Number(row.dispatched_quantity) : null,
    consignment_quantity:
      row.consignment_quantity != null ? Number(row.consignment_quantity) : null,
    overall_fill_rate:
      row.overall_fill_rate != null ? Number(row.overall_fill_rate) : null,
    raw:
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? (row.raw as Record<string, unknown>)
        : {},
  }));
}

function numOr0(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Image URL from stored `raw` JSON (listing blob or top-level). */
export function extractListingImageUrl(raw: unknown): string | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const listing =
    o.listing != null &&
    typeof o.listing === "object" &&
    !Array.isArray(o.listing)
      ? (o.listing as Record<string, unknown>)
      : o;
  const pick =
    listing.img_hd ??
    listing.img_wdim ??
    listing.img_white ??
    listing.image_url ??
    o.image_url;
  if (pick == null || pick === "") return null;
  const s = String(pick).trim();
  return s.length ? s : null;
}

/** One aggregated SKU row per `po_secondary_sku` for a consignment (mobile packing UI). */
export function mapGroupedConsignmentItemRow(row: Record<string, unknown>): Record<string, unknown> {
  const sku =
    row.po_secondary_sku != null ? String(row.po_secondary_sku) : "";
  const raw =
    row.raw != null &&
    typeof row.raw === "object" &&
    !Array.isArray(row.raw)
      ? (row.raw as Record<string, unknown>)
      : {};
  const demand = numOr0(row.original_demand);
  const packed = numOr0(row.consignment_quantity);
  const dispatched = numOr0(row.dispatched_quantity);
  const pending = Math.max(0, demand - packed - dispatched);
  const fill = row.overall_fill_rate;
  let fillNum = 0;
  if (fill != null && fill !== "") {
    const fn = Number(fill);
    fillNum = Number.isFinite(fn) ? fn : 0;
  } else if (demand > 0) {
    fillNum = (packed / demand) * 100;
  }
  const masterSku =
    raw.master_sku != null
      ? String(raw.master_sku)
      : raw.listing &&
          typeof raw.listing === "object" &&
          !Array.isArray(raw.listing) &&
          (raw.listing as Record<string, unknown>).master_sku != null
        ? String((raw.listing as Record<string, unknown>).master_sku)
        : "";

  return {
    id: row.id != null ? String(row.id) : sku,
    consignment_id: row.consignment_id,
    po_number: row.po_number,
    po_secondary_sku: sku,
    master_sku: masterSku || null,
    company_code_primary: row.company_code_primary,
    company_code_secondary: row.company_code_secondary,
    sku_id: sku,
    sku_name: sku,
    ccp: row.company_code_primary,
    ccs: row.company_code_secondary,
    image_url: extractListingImageUrl(raw),
    sku_type: raw.sku_type != null ? String(raw.sku_type) : null,
    warehouse_inventory: raw.available_quantity != null ? Number(raw.available_quantity) : null,
    demand,
    pending,
    packed,
    dispatched,
    fill_rate: Number.isFinite(fillNum) ? Math.round(fillNum * 100) / 100 : 0,
    fill_rate_percentage: Number.isFinite(fillNum) ? Math.round(fillNum * 100) / 100 : 0,
    overall_fill_rate: fill,
    raw,
  };
}

export async function listOutboundConsignmentItemsPaginated(opts: {
  consignmentId: number;
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  total: number;
  current_page: number;
  per_page_count: number;
  curr_page_count: number;
  content: Record<string, unknown>[];
}> {
  const { consignmentId, page, limit } = opts;
  const search =
    typeof opts.search === "string" ? opts.search.trim().toLowerCase() : "";
  const offset = (page - 1) * limit;

  const listR = await query(
    `WITH grouped AS (
       SELECT
         MIN(ci.id)::bigint AS id,
         ci.consignment_id,
         MAX(ci.po_number)::varchar AS po_number,
         ci.po_secondary_sku,
         MAX(ci.company_code_primary)::varchar AS company_code_primary,
         MAX(ci.company_code_secondary)::varchar AS company_code_secondary,
         SUM(COALESCE(ci.box_quantity, 0))::integer AS box_quantity,
         MAX(ci.original_demand)::integer AS original_demand,
         SUM(COALESCE(ci.dispatched_quantity, 0))::integer AS dispatched_quantity,
         SUM(COALESCE(ci.consignment_quantity, 0))::integer AS consignment_quantity,
         MAX(ci.overall_fill_rate)::numeric AS overall_fill_rate,
         (array_agg(ci.raw ORDER BY ci.id DESC))[1] AS raw
       FROM outbound_consignment_items ci
       WHERE ci.consignment_id = $1
         AND ci.po_secondary_sku IS NOT NULL
         AND TRIM(ci.po_secondary_sku) <> ''
       GROUP BY ci.consignment_id, ci.po_secondary_sku
     )
     SELECT * FROM grouped g
     WHERE $4::text = ''
        OR LOWER(g.po_secondary_sku) LIKE '%' || $4 || '%'
        OR LOWER(COALESCE(g.company_code_primary, '')) LIKE '%' || $4 || '%'
        OR LOWER(COALESCE(g.company_code_secondary, '')) LIKE '%' || $4 || '%'
     ORDER BY g.po_secondary_sku ASC
     LIMIT $2 OFFSET $3`,
    [consignmentId, limit, offset, search]
  );

  const countR = await query(
    `WITH grouped AS (
       SELECT
         ci.consignment_id,
         ci.po_secondary_sku,
         MAX(ci.company_code_primary)::varchar AS company_code_primary,
         MAX(ci.company_code_secondary)::varchar AS company_code_secondary
       FROM outbound_consignment_items ci
       WHERE ci.consignment_id = $1
         AND ci.po_secondary_sku IS NOT NULL
         AND TRIM(ci.po_secondary_sku) <> ''
       GROUP BY ci.consignment_id, ci.po_secondary_sku
     )
     SELECT COUNT(*)::int AS total FROM grouped g
     WHERE $2::text = ''
        OR LOWER(g.po_secondary_sku) LIKE '%' || $2 || '%'
        OR LOWER(COALESCE(g.company_code_primary, '')) LIKE '%' || $2 || '%'
        OR LOWER(COALESCE(g.company_code_secondary, '')) LIKE '%' || $2 || '%'`,
    [consignmentId, search]
  );
  const total = countR.rows[0]?.total as number;

  const content = listR.rows.map((row) =>
    mapGroupedConsignmentItemRow(row as Record<string, unknown>)
  );

  const consR = await query(
    `SELECT company_id FROM outbound_consignments WHERE id = $1 LIMIT 1`,
    [consignmentId]
  );
  const companyId =
    consR.rows[0]?.company_id != null ? Number(consR.rows[0].company_id) : null;
  const enriched = await enrichRowsWithZapEan(content, companyId);

  return {
    total,
    current_page: page,
    per_page_count: limit,
    curr_page_count: enriched.length,
    content: enriched,
  };
}

export type ValidBoxNameRow = { id: number; name: string };

export async function listOutboundValidBoxNames(): Promise<ValidBoxNameRow[]> {
  const r = await query(
    `SELECT id, name FROM outbound_valid_box_names ORDER BY name ASC`,
    []
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
  }));
}

export async function insertOutboundConsignmentBoxLines(opts: {
  consignmentId: number;
  poNumber: string;
  boxNumber: number;
  boxName: string;
  items: { po_secondary_sku: string; quantity: number }[];
  createdBy: string | null;
}): Promise<number> {
  const {
    consignmentId,
    poNumber,
    boxNumber,
    boxName,
    items,
    createdBy,
  } = opts;
  let n = 0;
  for (const it of items) {
    const sku = String(it.po_secondary_sku || "").trim();
    const qty = Math.trunc(Number(it.quantity));
    if (!sku || qty < 1) continue;

    const prev = await query(
      `SELECT MAX(company_code_primary) AS company_code_primary,
              MAX(company_code_secondary) AS company_code_secondary,
              MAX(original_demand)::integer AS max_original_demand
         FROM outbound_consignment_items
        WHERE consignment_id = $1 AND po_secondary_sku = $2`,
      [consignmentId, sku]
    );
    const p = prev.rows[0] as
      | {
          company_code_primary: unknown;
          company_code_secondary: unknown;
          max_original_demand: unknown;
        }
      | undefined;
    const demandHint =
      p?.max_original_demand != null && Number(p.max_original_demand) > 0
        ? Number(p.max_original_demand)
        : qty;

    await query(
      `INSERT INTO outbound_consignment_items (
         consignment_id, po_number, po_secondary_sku,
         company_code_primary, company_code_secondary,
         box_number, box_quantity, box_name,
         original_demand, dispatched_quantity, consignment_quantity,
         created_by, raw, synced_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13::jsonb, NOW()
       )`,
      [
        consignmentId,
        poNumber.slice(0, 80),
        sku.slice(0, 120),
        p?.company_code_primary != null
          ? String(p.company_code_primary).slice(0, 120)
          : null,
        p?.company_code_secondary != null
          ? String(p.company_code_secondary).slice(0, 120)
          : null,
        boxNumber,
        qty,
        boxName.slice(0, 120),
        demandHint,
        0,
        qty,
        createdBy != null ? createdBy.slice(0, 120) : null,
        JSON.stringify({
          source: "zap_mobile",
          box_number: boxNumber,
          box_name: boxName,
        }),
      ]
    );
    n += 1;
  }
  return n;
}

export type ConsignmentPackingValidationIssue = {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ConsignmentPackingPreviewRow = {
  rowNumber: number;
  binNumber: number;
  binName: string;
  itemCode: string;
  quantity: number;
  companyCodePrimary: string | null;
  companyCodeSecondary: string | null;
  status: "ok" | "error" | "warning";
  issues: string[];
};

export type ConsignmentPackingValidationResult = {
  ok: boolean;
  rowsPreview: ConsignmentPackingPreviewRow[];
  binSummary: { binNumber: number; binName: string; lineCount: number; totalQuantity: number }[];
  errors: ConsignmentPackingValidationIssue[];
  warnings: ConsignmentPackingValidationIssue[];
  stats: {
    totalRows: number;
    binCount: number;
    existingLineCount: number;
  };
  rows: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ParsedConsignmentPackingRow[];
};

function normalizeBinNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export type ConsignmentLineItemFlatRow = {
  id: number;
  po_secondary_sku: string;
  company_code_primary: string;
  company_code_secondary: string;
  box_number: number;
  box_quantity: number;
  box_name: string;
  submitted_from: string;
  created_by: string;
  mrp: number | null;
  original_demand: number;
  dispatched_quantity: number;
  consignment_quantity: number;
  overall_fill_rate: number | null;
  created_at: string;
  updated_at: string;
};

function formatConsignmentLineTimestamp(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Flat box lines for post-RTD tab views (default / box / SKU / PO wise). */
export async function listConsignmentLineItemRowsFlat(
  consignmentId: number
): Promise<ConsignmentLineItemFlatRow[]> {
  const r = await query(
    `SELECT id, po_secondary_sku, company_code_primary, company_code_secondary,
            box_number, box_quantity, box_name, submitted_from, created_by,
            created_at_ea, updated_at_ea, mrp, original_demand,
            dispatched_quantity, consignment_quantity, overall_fill_rate
       FROM outbound_consignment_items
      WHERE consignment_id = $1
      ORDER BY box_number ASC NULLS LAST, id ASC`,
    [consignmentId]
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    po_secondary_sku:
      row.po_secondary_sku != null ? String(row.po_secondary_sku).trim() : "",
    company_code_primary:
      row.company_code_primary != null ? String(row.company_code_primary).trim() : "",
    company_code_secondary:
      row.company_code_secondary != null ? String(row.company_code_secondary).trim() : "",
    box_number: row.box_number != null ? Number(row.box_number) : 0,
    box_quantity: row.box_quantity != null ? Number(row.box_quantity) : 0,
    box_name: row.box_name != null ? String(row.box_name).trim() : "",
    submitted_from:
      row.submitted_from != null ? String(row.submitted_from).trim() : "",
    created_by: row.created_by != null ? String(row.created_by).trim() : "",
    mrp: row.mrp != null && row.mrp !== "" ? Number(row.mrp) : null,
    original_demand:
      row.original_demand != null ? Number(row.original_demand) : 0,
    dispatched_quantity:
      row.dispatched_quantity != null ? Number(row.dispatched_quantity) : 0,
    consignment_quantity:
      row.consignment_quantity != null ? Number(row.consignment_quantity) : 0,
    overall_fill_rate:
      row.overall_fill_rate != null && row.overall_fill_rate !== ""
        ? Number(row.overall_fill_rate)
        : null,
    created_at: formatConsignmentLineTimestamp(row.created_at_ea),
    updated_at: formatConsignmentLineTimestamp(row.updated_at_ea),
  }));
}

export async function countConsignmentItemLines(
  consignmentId: number
): Promise<number> {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM outbound_consignment_items WHERE consignment_id = $1`,
    [consignmentId]
  );
  return Number(r.rows[0]?.n) || 0;
}

export async function validateConsignmentPackingRows(opts: {
  consignmentId: number;
  poNumber: string;
  rows: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ParsedConsignmentPackingRow[];
  parseErrors: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ConsignmentPackingParseError[];
  knownPoSkus?: Set<string>;
  knownConsignmentSkus?: Set<string>;
  /** When creating a new consignment, pass 0 to skip item-line count query. */
  existingLineCount?: number;
}): Promise<ConsignmentPackingValidationResult> {
  const { consignmentId, rows, parseErrors } = opts;
  const validBinNames = await listOutboundValidBoxNames();
  const validBinSet = new Set(
    validBinNames.map((b) => normalizeBinNameKey(b.name))
  );

  const errors: ConsignmentPackingValidationIssue[] = parseErrors.map((e) => ({
    row: e.row,
    field: e.field,
    message: e.message,
    severity: "error" as const,
  }));

  const warnings: ConsignmentPackingValidationIssue[] = [];
  const binNumberToName = new Map<number, string>();
  const knownPoSkus = opts.knownPoSkus ?? new Set<string>();
  const knownConsignmentSkus = opts.knownConsignmentSkus ?? new Set<string>();

  for (const row of rows) {
    const binKey = normalizeBinNameKey(row.box_name);
    if (validBinSet.size > 0 && !validBinSet.has(binKey)) {
      errors.push({
        row: row.rowNumber,
        field: "Bin Name",
        message: `Bin Name "${row.box_name}" not in system — sync bin names or pick from list`,
        severity: "error",
      });
    }

    const prevName = binNumberToName.get(row.box_number);
    if (prevName && normalizeBinNameKey(prevName) !== binKey) {
      errors.push({
        row: row.rowNumber,
        field: "Bin Number",
        message: `Bin Number ${row.box_number} is used with different bin names in this file`,
        severity: "error",
      });
    } else {
      binNumberToName.set(row.box_number, row.box_name);
    }

    if (
      knownPoSkus.size > 0 &&
      !knownPoSkus.has(row.po_secondary_sku) &&
      (knownConsignmentSkus.size === 0 ||
        !knownConsignmentSkus.has(row.po_secondary_sku))
    ) {
      warnings.push({
        row: row.rowNumber,
        field: "Item Code",
        message: `Item Code "${row.po_secondary_sku}" not found on PO or existing consignment lines`,
        severity: "warning",
      });
    }
  }

  const errorRows = new Set(errors.map((e) => e.row));

  const rowsPreview: ConsignmentPackingPreviewRow[] = rows.map((row) => {
    const rowErrors = errors.filter((e) => e.row === row.rowNumber);
    const rowWarnings = warnings.filter((w) => w.row === row.rowNumber);
    const issues = [
      ...rowErrors.map((e) => e.message),
      ...rowWarnings.map((w) => w.message),
    ];
    let status: "ok" | "error" | "warning" = "ok";
    if (rowErrors.length > 0 || errorRows.has(row.rowNumber)) status = "error";
    else if (rowWarnings.length > 0) status = "warning";
    return {
      rowNumber: row.rowNumber,
      binNumber: row.box_number,
      binName: row.box_name,
      itemCode: row.po_secondary_sku,
      quantity: row.quantity,
      companyCodePrimary: row.company_code_primary,
      companyCodeSecondary: row.company_code_secondary,
      status,
      issues,
    };
  });

  const binMap = new Map<string, { binNumber: number; binName: string; lineCount: number; totalQuantity: number }>();
  for (const row of rows) {
    const key = `${row.box_number}::${normalizeBinNameKey(row.box_name)}`;
    const cur = binMap.get(key) ?? {
      binNumber: row.box_number,
      binName: row.box_name,
      lineCount: 0,
      totalQuantity: 0,
    };
    cur.lineCount += 1;
    cur.totalQuantity += row.quantity;
    binMap.set(key, cur);
  }

  const existingLineCount =
    opts.existingLineCount ??
    (consignmentId > 0 ? await countConsignmentItemLines(consignmentId) : 0);
  const blockingErrors = errors.filter((e) => e.severity === "error");

  return {
    ok: blockingErrors.length === 0 && rows.length > 0,
    rowsPreview,
    binSummary: [...binMap.values()].sort((a, b) => a.binNumber - b.binNumber),
    errors: blockingErrors,
    warnings,
    stats: {
      totalRows: rows.length,
      binCount: binMap.size,
      existingLineCount,
    },
    rows,
  };
}

export async function refreshOutboundConsignmentAggregates(
  consignmentId: number
): Promise<void> {
  await query(
    `UPDATE outbound_consignments AS c SET
       boxes_count = sub.boxes_count,
       sku_count = sub.sku_count,
       total_quantity = sub.total_quantity
     FROM (
       SELECT
         COUNT(DISTINCT box_number)::int AS boxes_count,
         COUNT(DISTINCT po_secondary_sku)::int AS sku_count,
         COALESCE(SUM(box_quantity), 0)::int AS total_quantity
       FROM outbound_consignment_items
       WHERE consignment_id = $1
     ) AS sub
     WHERE c.id = $1`,
    [consignmentId]
  );
}

export async function applyConsignmentPackingUpload(opts: {
  consignmentId: number;
  poNumber: string;
  rows: import("@/server/utils/outboundConsignmentPackingSpreadsheetParse").ParsedConsignmentPackingRow[];
  mode: "append" | "replace";
  createdBy: string | null;
}): Promise<{ inserted: number; deleted: number; binsAffected: number }> {
  const { consignmentId, poNumber, rows, mode, createdBy } = opts;
  const grouped = groupPackingRowsByBin(rows);
  let deleted = 0;
  let inserted = 0;

  if (mode === "replace") {
    const mappedRows = rows.map((row) => ({
      box_number: row.box_number,
      box_name: row.box_name,
      po_secondary_sku: row.po_secondary_sku,
      box_quantity: row.quantity,
      consignment_quantity: row.quantity,
      company_code_primary: row.company_code_primary,
      company_code_secondary: row.company_code_secondary,
      submitted_from: "zap_web_csv",
      source: "zap_web_csv",
    }));
    deleted = await countConsignmentItemLines(consignmentId);
    inserted = await replaceConsignmentItems(
      consignmentId,
      mappedRows,
      poNumber
    );
  } else {
    for (const bin of grouped) {
      const n = await insertOutboundConsignmentBoxLines({
        consignmentId,
        poNumber,
        boxNumber: bin.box_number,
        boxName: bin.box_name,
        items: bin.items.map((it) => ({
          po_secondary_sku: it.po_secondary_sku,
          quantity: it.quantity,
        })),
        createdBy,
      });
      inserted += n;
    }
  }

  await refreshOutboundConsignmentAggregates(consignmentId);

  const aggR = await query(
    `SELECT boxes_count, sku_count, total_quantity FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  const agg = aggR.rows[0] as
    | { boxes_count?: number | null; sku_count?: number | null; total_quantity?: number | null }
    | undefined;

  await logConsignmentActivityFromZap({
    consignmentId,
    operation: mode === "replace" ? "Bin packing replaced" : "Bin packing appended",
    remarks: `${inserted} line(s) across ${grouped.length} box(es). ${deleted > 0 ? `${deleted} previous line(s) removed. ` : ""}Boxes: ${agg?.boxes_count ?? 0}, SKUs: ${agg?.sku_count ?? 0}, Qty: ${agg?.total_quantity ?? 0}.`,
    createdBy,
  });

  return { inserted, deleted, binsAffected: grouped.length };
}

function numFromUnknown(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function itemDbRowToLineDraft(row: Record<string, unknown>): ConsignmentLineDraft {
  const raw =
    row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
      ? (row.raw as Record<string, unknown>)
      : {};
  return {
    po_secondary_sku:
      row.po_secondary_sku != null ? String(row.po_secondary_sku).trim() : "",
    company_code_primary:
      row.company_code_primary != null ? String(row.company_code_primary).trim() : "",
    demand_quantity: numFromUnknown(row.original_demand),
    dispatched_quantity: numFromUnknown(row.dispatched_quantity),
    reserved_quantity: numFromUnknown(raw.reserved_quantity),
    pending_quantity: numFromUnknown(raw.pending_quantity),
    box_number: Math.trunc(numFromUnknown(row.box_number)),
    box_quantity: Math.trunc(numFromUnknown(row.box_quantity)),
    box_name: row.box_name != null ? String(row.box_name).trim() : "",
  };
}

export async function getConsignmentLineRowsForEditor(consignmentId: number): Promise<{
  source: "saved" | "draft";
  skus: ConsignmentSkuPacking[];
  outboundPoId: number | null;
  poNumber: string | null;
}> {
  const cR = await query(
    `SELECT po_number FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  const poNumber =
    cR.rows[0]?.po_number != null ? String(cR.rows[0].po_number).trim() : null;

  const lineCount = await countConsignmentItemLines(consignmentId);
  let outboundPoId: number | null = null;
  let templateSkus: ConsignmentSkuPacking[] = [];
  if (poNumber) {
    const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
    outboundPoId = po?.id ?? null;
    if (po?.listings_snapshot != null) {
      // Must enrich before extract — same path as PO detail (`/purchase-orders/[id]/detail`)
      // and consignment PO listings (`/consignments/[id]/po-listings`). Raw spreadsheet
      // snapshots often set company_code_primary = po_secondary_sku (e.g. 10149918); EAN /
      // listings resolution yields the product code (e.g. AAC500) shown in both tables.
      const enriched = await enrichListingsSnapshotWithZapEan(
        po.listings_snapshot,
        po.company_id
      );
      templateSkus = extractConsignmentSkuPackingFromListings(enriched);
    }
  }

  if (lineCount > 0) {
    const r = await query(
      `SELECT po_secondary_sku, company_code_primary, box_number, box_name, box_quantity,
              original_demand, dispatched_quantity, raw
         FROM outbound_consignment_items
        WHERE consignment_id = $1
        ORDER BY id ASC`,
      [consignmentId]
    );
    const flat = r.rows.map((row) => itemDbRowToLineDraft(row as Record<string, unknown>));
    return {
      source: "saved",
      skus: groupLineRowsToSkuPacking(flat, templateSkus),
      outboundPoId,
      poNumber,
    };
  }

  return {
    source: "draft",
    skus: templateSkus,
    outboundPoId,
    poNumber,
  };
}

export type ConsignmentLineValidationIssue = {
  skuIndex: number;
  boxIndex?: number;
  field: string;
  message: string;
};

export async function validateConsignmentSkuPacking(
  skus: ConsignmentSkuPacking[]
): Promise<{ ok: boolean; errors: ConsignmentLineValidationIssue[] }> {
  const validBinNames = await listOutboundValidBoxNames();
  const validBinSet = new Set(
    validBinNames.map((b) => normalizeBinNameKey(b.name))
  );
  const result = validateConsignmentSkuPackingClient(skus, validBinSet);
  return { ok: result.ok, errors: result.errors };
}

export async function listOutboundTransporters(): Promise<
  { id: number; name: string }[]
> {
  const r = await query(
    `SELECT id, name FROM outbound_transporter_details ORDER BY name ASC`
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    name: row.name != null ? String(row.name) : "",
  }));
}

export async function saveConsignmentLineItems(opts: {
  consignmentId: number;
  poNumber: string;
  skus: ConsignmentSkuPacking[];
  createdBy: string | null;
}): Promise<{ inserted: number }> {
  const { consignmentId, poNumber, skus, createdBy } = opts;

  const statusR = await query(
    `SELECT consignment_status FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  if (statusR.rows.length === 0) {
    throw new AppError("Consignment not found", 404);
  }
  const statusNorm = String(statusR.rows[0]?.consignment_status ?? "")
    .trim()
    .toLowerCase();
  if (statusNorm === "marked_rtd") {
    throw new AppError(
      "Cannot edit line items after consignment is marked for dispatch",
      409
    );
  }

  const validation = await validateConsignmentSkuPacking(skus);
  if (!validation.ok) {
    throw new AppError(
      validation.errors[0]?.message ?? "Invalid consignment line items",
      400
    );
  }

  const rows = flattenSkuPackingToLineRows(skus);
  const mapped = rows.map((row) => {
    const demand = Math.trunc(row.demand_quantity);
    const boxQty = Math.trunc(row.box_quantity);
    const fillRate = demand > 0 ? boxQty / demand : null;
    return {
      po_secondary_sku: row.po_secondary_sku.trim(),
      company_code_primary: row.company_code_primary.trim(),
      original_demand: demand,
      demand_quantity: demand,
      dispatched_quantity: Math.trunc(row.dispatched_quantity),
      reserved_quantity: Math.trunc(row.reserved_quantity),
      pending_quantity: Math.trunc(row.pending_quantity),
      box_number: Math.trunc(row.box_number),
      box_quantity: boxQty,
      box_name: row.box_name.trim(),
      consignment_quantity: boxQty,
      overall_fill_rate: fillRate,
      submitted_from: "zap_web_lines",
      created_by: createdBy,
    };
  });

  const inserted = await replaceConsignmentItems(consignmentId, mapped, poNumber);
  await refreshOutboundConsignmentAggregates(consignmentId);

  const aggR = await query(
    `SELECT boxes_count, sku_count, total_quantity FROM outbound_consignments WHERE id = $1`,
    [consignmentId]
  );
  const agg = aggR.rows[0] as
    | { boxes_count?: number | null; sku_count?: number | null; total_quantity?: number | null }
    | undefined;
  const boxCount = agg?.boxes_count != null ? Number(agg.boxes_count) : 0;
  const skuCount = agg?.sku_count != null ? Number(agg.sku_count) : 0;
  const totalQty = agg?.total_quantity != null ? Number(agg.total_quantity) : 0;
  const distinctSkus = new Set(skus.map((s) => s.po_secondary_sku.trim()).filter(Boolean)).size;

  await logConsignmentActivityFromZap({
    consignmentId,
    operation: "Consignment line items saved",
    remarks: `${inserted} box line(s) saved for ${distinctSkus} SKU(s). Summary: ${boxCount} box(es), ${skuCount} SKU row(s), ${totalQty} total qty.`,
    createdBy,
  });

  const po = await getOutboundPurchaseOrderByPoNumber(poNumber);
  if (po?.id) {
    await rollupPoPackedQuantitiesFromConsignments(po.id, poNumber);
  }

  return { inserted };
}

/** Refresh commercial columns on existing consignment items from PO listing rows. */
export async function syncOutboundConsignmentItemsCommercialFromListingRows(
  poNumber: string,
  normalizedRows: Record<string, unknown>[]
): Promise<number> {
  const pn = String(poNumber || "").trim();
  if (!pn || normalizedRows.length === 0) return 0;

  const rowsBySku = new Map(
    normalizedRows
      .filter((l) => l.po_secondary_sku != null)
      .map((l) => [String(l.po_secondary_sku).trim(), l])
  );
  if (rowsBySku.size === 0) return 0;

  const itemsR = await query(
    `SELECT id, po_secondary_sku
       FROM outbound_consignment_items
      WHERE po_number = $1`,
    [pn]
  );

  let updated = 0;
  for (const item of itemsR.rows as {
    id: number;
    po_secondary_sku: string | null;
  }[]) {
    const sku = item.po_secondary_sku != null ? String(item.po_secondary_sku).trim() : "";
    const normalized = sku ? rowsBySku.get(sku) : undefined;
    if (!sku || !normalized) continue;

    const cols = mapListingRowToItemColumns(normalized, pn);
    await query(
      `UPDATE outbound_consignment_items
          SET po_number = $2,
              po_secondary_sku = $3,
              company_code_primary = $4,
              company_code_secondary = $5,
              mrp = $6,
              original_demand = $7,
              raw = $8::jsonb
        WHERE id = $1`,
      [
        item.id,
        cols.po_number,
        cols.po_secondary_sku,
        cols.company_code_primary,
        cols.company_code_secondary,
        cols.mrp,
        cols.original_demand,
        cols.rawJson,
      ]
    );
    updated += 1;
  }
  return updated;
}
