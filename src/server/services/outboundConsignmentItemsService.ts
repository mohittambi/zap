import getPool, { query } from "@/server/db";

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

export async function getProductLabelRowsByPoNumber(
  poNumber: string
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
            COALESCE(lm.mrp::text, '')       AS mrp_now
       FROM outbound_consignment_items ci
       LEFT JOIN labels_master_data lm ON lm.secondary_sku = ci.po_secondary_sku
      WHERE ci.po_number = $1
      ORDER BY ci.po_secondary_sku ASC, ci.id ASC`,
    [pn]
  );
  return r.rows.map((row) => {
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
}

/**
 * Build ProductLabelRow[] from a `listings_snapshot` content array.
 * Used as fallback when `outbound_consignment_items` has no rows for the PO.
 * Enriches with `labels_master_data` where available; fills from snapshot fields otherwise.
 */
export async function getProductLabelRowsFromSnapshot(
  snapshotRows: Record<string, unknown>[]
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
  const result: ProductLabelRow[] = [];
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

    result.push({
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
  return result;
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
