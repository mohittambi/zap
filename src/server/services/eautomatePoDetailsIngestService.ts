import getPool, { query } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  eautomateConfigured,
  fetchEautomate,
  getEautomateBaseUrl,
} from "@/server/eautomate-proxy";
import {
  ACCEPTED_QTY_KEYS,
  INVOICE_QTY_KEYS,
  REJECTED_QTY_KEYS,
  SHORT_QTY_KEYS,
  sqlPickQtyFromRaw,
} from "@/lib/inboundGrnQuantities";

/** JSON text for Postgres jsonb (BigInt + non-finite numbers; avoids driver/json edge cases). */
function toJsonbString(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  });
}

function num(v: unknown, fallback: number | null = null): number | null {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function pick(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>;
  return null;
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const o = asRecord(data);
  if (!o) return [];
  for (const k of [
    "content",
    "data",
    "items",
    "grns",
    "results",
    "purchase_order_grns",
  ]) {
    const a = o[k];
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeSkuNamesPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const o = asRecord(raw);
  if (!o) return [];
  for (const k of ["data", "content", "names", "sku_names"]) {
    const a = o[k];
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeVendorListingsPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  return extractArray(raw);
}

async function fetchEautomateJson(pathSuffix: string): Promise<unknown> {
  if (!eautomateConfigured()) {
    throw new AppError(
      "eautomate is not configured: set EAUTOMATE_COOKIE (or EAUTOMATE_BEARER_TOKEN) in .env.local.",
      503
    );
  }
  const base = getEautomateBaseUrl();
  const u = `${base}/public/api${pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`}`;
  const res = await fetchEautomate(u, {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `eautomate HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new AppError(msg, res.status >= 500 ? 502 : res.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("Invalid JSON from eautomate", 502);
  }
}

function skuFromLine(line: Record<string, unknown>): string | null {
  const listing = asRecord(pick(line, ["listing", "Listing"]));
  const fromListing = listing
    ? str(pick(listing, ["sku_id", "skuId", "SKU_ID"]))
    : null;
  return (
    fromListing ??
    str(pick(line, ["sku_id", "skuId", "SKU_ID", "secondary_sku_id"]))
  );
}

function grnIdFromRow(row: Record<string, unknown>): number | null {
  const nested = asRecord(row.grn);
  const top = num(pick(row, ["grn_id", "grnId"]), null);
  if (top != null) return top;
  if (nested) {
    const g = num(pick(nested, ["grn_id", "grnId"]), null);
    if (g != null) return g;
  }
  return num(pick(row, ["id"]), null);
}

/**
 * When PO detail is re-ingested from eAutomate, merge these keys from the existing
 * `po_raw` row so in-app actions (cancel, notes) are not overwritten by sync.
 */
const INBOUND_PO_RAW_ZAP_MERGE_KEYS = [
  "zap_status",
  "zap_cancelled_at",
  "zap_cancelled_by",
  "zap_notes",
  "zap_modified_at",
  "zap_modified_by",
] as const;

function mergeZapFieldsIntoIncomingPoRaw(
  incomingPoJson: unknown,
  existingPoRaw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base =
    incomingPoJson &&
    typeof incomingPoJson === "object" &&
    !Array.isArray(incomingPoJson)
      ? { ...(incomingPoJson as Record<string, unknown>) }
      : {};
  if (!existingPoRaw) return base;
  for (const k of INBOUND_PO_RAW_ZAP_MERGE_KEYS) {
    const v = existingPoRaw[k];
    if (v !== undefined && v !== null && v !== "") {
      base[k] = v;
    }
  }
  return base;
}

export async function ingestPoDetailsByVendorAndPo(
  vendorId: number,
  poId: number
): Promise<void> {
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("Invalid vendor id", 400);
  }
  if (!Number.isFinite(poId) || poId < 1) {
    throw new AppError("Invalid po id", 400);
  }

  /** zap is the source of truth for the PO and its vendor binding; eAutomate provides only line/GRN/listing data. */
  const poRow = await query(
    `SELECT vendor_id, source FROM vendor_purchase_orders WHERE po_id = $1`,
    [poId]
  );
  if (poRow.rows.length === 0) {
    throw new AppError("PO not found", 404);
  }
  /** Zap-created POs share an id namespace with eAutomate but have no upstream
   * counterpart. Calling eAutomate would return a phantom PO and pollute
   * inbound_po_detail_* tables (the GRN-3157-under-zap-PO-16719 bug). Skip. */
  if (poRow.rows[0].source === "zap") {
    console.warn(
      `[ingestPoDetailsByVendorAndPo] skip po_id=${poId}: source=zap (no eAutomate counterpart)`
    );
    return;
  }
  const canonicalVendorId = Number(poRow.rows[0].vendor_id);

  const [skuNamesJson, poJson, addedJson, grnsJson, vendorJson, listingsJson] =
    await Promise.all([
      fetchEautomateJson(`/listings/sku/names`).catch(() => null),
      fetchEautomateJson(`/purchase_orders/${poId}`).catch(() => null),
      fetchEautomateJson(
        `/purchase_orders/addedItems/withListing/${poId}`
      ).catch(() => null),
      fetchEautomateJson(`/purchase_orders/grn/get_by_po_id/${poId}`).catch(
        () => null
      ),
      fetchEautomateJson(`/vendors/${canonicalVendorId}`).catch(() => null),
      fetchEautomateJson(`/vendors/listings/${canonicalVendorId}`).catch(
        () => null
      ),
    ]);

  const vendorListingsArr = normalizeVendorListingsPayload(listingsJson);
  const skuNamesArr = normalizeSkuNamesPayload(skuNamesJson);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingSnap = await client.query(
      `SELECT po_raw FROM inbound_po_detail_snapshot WHERE po_id = $1`,
      [poId]
    );
    const existingPoRaw =
      existingSnap.rows.length > 0
        ? (existingSnap.rows[0].po_raw as Record<string, unknown>)
        : null;
    const mergedPoRaw = mergeZapFieldsIntoIncomingPoRaw(poJson, existingPoRaw);

    await client.query(
      `INSERT INTO inbound_po_detail_snapshot (
        po_id, vendor_id, synced_at,
        vendor_raw, vendor_listings_raw, sku_names_raw, po_raw
      ) VALUES ($1, $2, NOW(), $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
      ON CONFLICT (po_id) DO UPDATE SET
        vendor_id = EXCLUDED.vendor_id,
        synced_at = NOW(),
        vendor_raw = EXCLUDED.vendor_raw,
        vendor_listings_raw = EXCLUDED.vendor_listings_raw,
        sku_names_raw = EXCLUDED.sku_names_raw,
        po_raw = EXCLUDED.po_raw`,
      [
        poId,
        canonicalVendorId,
        toJsonbString(vendorJson ?? {}),
        toJsonbString(vendorListingsArr),
        toJsonbString(skuNamesArr),
        toJsonbString(mergedPoRaw),
      ]
    );

    await client.query(`DELETE FROM inbound_po_detail_lines WHERE po_id = $1`, [
      poId,
    ]);
    const lineRows = extractArray(addedJson);
    for (let i = 0; i < lineRows.length; i += 1) {
      const line = asRecord(lineRows[i]);
      if (!line) continue;
      const sku = skuFromLine(line);
      await client.query(
        `INSERT INTO inbound_po_detail_lines (po_id, line_index, sku_id, raw)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [poId, i, sku, toJsonbString(line)]
      );
    }

    await client.query(`DELETE FROM inbound_po_detail_grns WHERE po_id = $1`, [
      poId,
    ]);
    const grnRows = extractArray(grnsJson);
    for (let i = 0; i < grnRows.length; i += 1) {
      const row = asRecord(grnRows[i]);
      if (!row) continue;
      const gid = grnIdFromRow(row);
      await client.query(
        `INSERT INTO inbound_po_detail_grns (po_id, sort_index, grn_id, raw)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [poId, i, gid, toJsonbString(row)]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function snapshotExists(poId: number): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM inbound_po_detail_snapshot WHERE po_id = $1 LIMIT 1`,
    [poId]
  );
  return r.rows.length > 0;
}

export function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

export function toNullableNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toNumberOrZero(v: unknown): number {
  return toNullableNumber(v) ?? 0;
}

export type PoSource = "zap" | "eautomate";

export type PoDetailsIngestNeed = {
  needed: boolean;
  reason: string;
};

/** Pure rule: eAutomate POs need detail ingest when snapshot/lines are missing. */
export function poDetailsIngestNeededFromCounts(
  source: PoSource,
  skuCount: number,
  hasSnapshot: boolean,
  lineCount: number
): PoDetailsIngestNeed {
  if (source === "zap") {
    return {
      needed: false,
      reason: "zap-source PO (lines live in vendor_purchase_order_lines)",
    };
  }
  if (!hasSnapshot) {
    return { needed: true, reason: "no inbound_po_detail_snapshot" };
  }
  if (lineCount === 0 && skuCount > 0) {
    return {
      needed: true,
      reason: "no inbound_po_detail_lines (header reports SKUs)",
    };
  }
  return { needed: false, reason: "snapshot and lines present" };
}

/** DB check for a single PO (used by sync:if-needed scripts). */
export async function checkPoDetailsIngestNeeded(poId: number): Promise<
  PoDetailsIngestNeed & {
    vendor_id: number | null;
    source: PoSource | null;
  }
> {
  const h = await query(
    `SELECT vendor_id, source, sku_count FROM vendor_purchase_orders WHERE po_id = $1`,
    [poId]
  );
  if (h.rows.length === 0) {
    return { needed: false, reason: "PO not found", vendor_id: null, source: null };
  }
  const row = h.rows[0] as Record<string, unknown>;
  const source: PoSource = row.source === "zap" ? "zap" : "eautomate";
  const skuCount = toNumberOrZero(row.sku_count);
  const vendor_id = toNullableNumber(row.vendor_id);

  const [snapR, linesR] = await Promise.all([
    query(
      `SELECT 1 FROM inbound_po_detail_snapshot WHERE po_id = $1 LIMIT 1`,
      [poId]
    ),
    source === "zap"
      ? query(
          `SELECT count(*)::int AS n FROM vendor_purchase_order_lines WHERE po_id = $1`,
          [poId]
        )
      : query(
          `SELECT count(*)::int AS n FROM inbound_po_detail_lines WHERE po_id = $1`,
          [poId]
        ),
  ]);
  const hasSnapshot = snapR.rows.length > 0;
  const lineCount = Number((linesR.rows[0] as { n?: number })?.n ?? 0);
  const need = poDetailsIngestNeededFromCounts(
    source,
    skuCount,
    hasSnapshot,
    lineCount
  );
  return { ...need, vendor_id, source };
}

export type PoDetailIngestPair = {
  vendor_id: number;
  po_id: number;
  reason: string;
};

/**
 * eAutomate POs missing snapshot and/or line rows (vital for PO detail SKU lines).
 * Used by sync:po:details* --missing-only and sync:po:details:if-needed.
 */
export async function listPoIdsNeedingDetailIngest(options?: {
  vendorId?: number;
  poId?: number;
}): Promise<PoDetailIngestPair[]> {
  const params: unknown[] = [];
  const filters: string[] = [`po.source = 'eautomate'`];
  if (options?.vendorId != null && Number.isFinite(options.vendorId)) {
    params.push(options.vendorId);
    filters.push(`po.vendor_id = $${params.length}`);
  }
  if (options?.poId != null && Number.isFinite(options.poId)) {
    params.push(options.poId);
    filters.push(`po.po_id = $${params.length}`);
  }
  filters.push(`(
    NOT EXISTS (
      SELECT 1 FROM inbound_po_detail_snapshot s WHERE s.po_id = po.po_id
    )
    OR (
      po.sku_count > 0
      AND NOT EXISTS (
        SELECT 1 FROM inbound_po_detail_lines l WHERE l.po_id = po.po_id
      )
    )
  )`);

  const r = await query(
    `SELECT po.vendor_id,
            po.po_id,
            po.sku_count,
            EXISTS (
              SELECT 1 FROM inbound_po_detail_snapshot s WHERE s.po_id = po.po_id
            ) AS has_snapshot,
            (
              SELECT count(*)::int
                FROM inbound_po_detail_lines l
               WHERE l.po_id = po.po_id
            ) AS line_count
       FROM vendor_purchase_orders po
      WHERE ${filters.join(" AND ")}
      ORDER BY po.po_id ASC`,
    params
  );

  const out: PoDetailIngestPair[] = [];
  for (const row of r.rows as Record<string, unknown>[]) {
    const skuCount = toNumberOrZero(row.sku_count);
    const hasSnapshot = Boolean(row.has_snapshot);
    const lineCount = Number(row.line_count ?? 0);
    const need = poDetailsIngestNeededFromCounts(
      "eautomate",
      skuCount,
      hasSnapshot,
      lineCount
    );
    if (!need.needed) continue;
    out.push({
      vendor_id: Number(row.vendor_id),
      po_id: Number(row.po_id),
      reason: need.reason,
    });
  }
  return out;
}

export type PoDetailHeader = {
  po_id: number;
  vendor_id: number;
  vendor_name: string | null;
  vendor_city: string | null;
  vendor_state: string | null;
  expected_date: string | null;
  status: string | null;
  po_remarks: string | null;
  created_by: string | null;
  modified_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  date_published: string | null;
  sku_count: number;
  total_quantity: number;
  number_of_grns: number;
  total_invoice_quantity: number;
  total_accepted_quantity: number;
  total_rejected_quantity: number;
  sku_fill_rate: number;
  quantity_fill_rate: number;
  /** Where this PO originated. zap-source POs never display eAutomate snapshot rows. */
  source: PoSource;
};

export function rowToHeader(r: Record<string, unknown>): PoDetailHeader {
  const sourceRaw = typeof r.source === "string" ? r.source : "eautomate";
  const source: PoSource = sourceRaw === "zap" ? "zap" : "eautomate";
  return {
    po_id: Number(r.po_id),
    vendor_id: Number(r.vendor_id),
    vendor_name: (r.vendor_name as string | null) ?? null,
    vendor_city: (r.vendor_city as string | null) ?? null,
    vendor_state: (r.vendor_state as string | null) ?? null,
    expected_date: isoOrNull(r.expected_date),
    status: (r.status as string | null) ?? null,
    po_remarks: (r.po_remarks as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    modified_by: (r.modified_by as string | null) ?? null,
    created_at: isoOrNull(r.created_at),
    updated_at: isoOrNull(r.updated_at),
    date_published: isoOrNull(r.date_published),
    sku_count: toNumberOrZero(r.sku_count),
    total_quantity: toNumberOrZero(r.total_quantity),
    number_of_grns: toNumberOrZero(r.number_of_grns),
    total_invoice_quantity: toNumberOrZero(r.total_invoice_quantity),
    total_accepted_quantity: toNumberOrZero(r.total_accepted_quantity),
    total_rejected_quantity: toNumberOrZero(r.total_rejected_quantity),
    sku_fill_rate: toNumberOrZero(r.sku_fill_rate),
    quantity_fill_rate: toNumberOrZero(r.quantity_fill_rate),
    source,
  };
}

type PoLineReceiptTotals = {
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  shortage_quantity: number;
};

async function fetchPoLineReceiptBySku(
  poId: number
): Promise<Map<string, PoLineReceiptTotals>> {
  const r = await query(
    `SELECT i.sku_id,
            COALESCE(SUM(${sqlPickQtyFromRaw("i", INVOICE_QTY_KEYS)}), 0)::int AS received_quantity,
            COALESCE(SUM(${sqlPickQtyFromRaw("i", ACCEPTED_QTY_KEYS)}), 0)::int AS accepted_quantity,
            COALESCE(SUM(${sqlPickQtyFromRaw("i", REJECTED_QTY_KEYS)}), 0)::int AS rejected_quantity,
            COALESCE(SUM(${sqlPickQtyFromRaw("i", SHORT_QTY_KEYS)}), 0)::int AS shortage_quantity
       FROM inbound_grn_items i
       JOIN inbound_grns g ON g.grn_id = i.grn_id
      WHERE g.po_id = $1
        AND i.sku_id IS NOT NULL
        AND TRIM(i.sku_id) <> ''
      GROUP BY i.sku_id`,
    [poId]
  );
  const out = new Map<string, PoLineReceiptTotals>();
  for (const row of r.rows) {
    const sku = String(row.sku_id ?? "").trim();
    if (!sku) continue;
    out.set(sku, {
      received_quantity: Number(row.received_quantity ?? 0),
      accepted_quantity: Number(row.accepted_quantity ?? 0),
      rejected_quantity: Number(row.rejected_quantity ?? 0),
      shortage_quantity: Number(row.shortage_quantity ?? 0),
    });
  }
  return out;
}

export function mergeGrnReceiptIntoPoLines(
  lines: ReadonlyArray<Record<string, unknown>>,
  receiptBySku: Map<string, PoLineReceiptTotals>
): Record<string, unknown>[] {
  return lines.map((line) => {
    const sku = String(line.sku_id ?? "").trim();
    const base =
      line.raw && typeof line.raw === "object" && !Array.isArray(line.raw)
        ? { ...(line.raw as Record<string, unknown>) }
        : {};
    const receipt = sku ? receiptBySku.get(sku) : undefined;
    if (!receipt) return line;
    return {
      ...line,
      raw: {
        ...base,
        invoice_quantity: receipt.received_quantity,
        received_quantity: receipt.received_quantity,
        accepted_quantity: receipt.accepted_quantity,
        rejected_quantity: receipt.rejected_quantity,
        shortage_quantity: receipt.shortage_quantity,
      },
    };
  });
}

export async function getPoDetailsBundle(vendorId: number, poId: number) {
  if (!Number.isFinite(vendorId) || vendorId < 1) {
    throw new AppError("Invalid vendor id", 400);
  }
  if (!Number.isFinite(poId) || poId < 1) {
    throw new AppError("Invalid po id", 400);
  }

  /** Header is canonical from zap DB; eAutomate snapshot is only for line/GRN/listing data. */
  const headerR = await query(
    `SELECT po.po_id, po.vendor_id, v.vendor_name, v.vendor_city, v.vendor_state,
            po.expected_date, po.status, po.po_remarks,
            po.created_by, po.modified_by, po.created_at, po.updated_at, po.date_published,
            po.sku_count, po.total_quantity, po.number_of_grns,
            po.total_invoice_quantity, po.total_accepted_quantity, po.total_rejected_quantity,
            po.sku_fill_rate, po.quantity_fill_rate,
            po.source
       FROM vendor_purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
      WHERE po.po_id = $1`,
    [poId]
  );
  if (headerR.rows.length === 0) {
    throw new AppError("PO not found", 404);
  }
  const header = rowToHeader(headerR.rows[0] as Record<string, unknown>);

  const snapR = await query(
    `SELECT po_id, vendor_id, synced_at, vendor_raw, vendor_listings_raw, sku_names_raw, po_raw
     FROM inbound_po_detail_snapshot WHERE po_id = $1`,
    [poId]
  );
  /** Snapshot is the eAutomate-sourced supplement; absence is normal for locally-created POs. */
  const snap: Record<string, unknown> =
    snapR.rows.length > 0
      ? (snapR.rows[0] as Record<string, unknown>)
      : {
          po_id: poId,
          vendor_id: header.vendor_id,
          synced_at: null,
          vendor_raw: {},
          vendor_listings_raw: [],
          sku_names_raw: [],
          po_raw: {},
        };

  /** Lines: zap-source POs use the canonical zap-side line items; eAutomate-source
   * POs use the snapshot mirror. The snapshot table has no meaning for zap POs. */
  const linesR =
    header.source === "zap"
      ? await query(
          `SELECT row_number() OVER (ORDER BY id) - 1 AS line_index,
                  sku_id,
                  jsonb_build_object(
                    'sku_id', sku_id,
                    'quantity', quantity,
                    'created_at', created_at
                  ) AS raw
             FROM vendor_purchase_order_lines
            WHERE po_id = $1
            ORDER BY id`,
          [poId]
        )
      : await query(
          `SELECT line_index, sku_id, raw FROM inbound_po_detail_lines WHERE po_id = $1 ORDER BY line_index`,
          [poId]
        );

  const receiptBySku = await fetchPoLineReceiptBySku(poId);
  const lines = mergeGrnReceiptIntoPoLines(
    linesR.rows as Record<string, unknown>[],
    receiptBySku
  );

  /** GRNs come from two zap-side tables (no eAutomate calls):
   *   - inbound_po_detail_grns: rich raw JSONB mirrored by sync:po:details*
   *   - inbound_grns:           canonical GRN rows (zap-created drafts have negative grn_ids,
   *                             synced rows have positive ids; both belong on the PO detail view)
   * For zap-source POs, the snapshot is excluded — those rows would be phantoms
   * from the eAutomate id-space collision (e.g. GRN 3157 under zap PO 16719).
   */
  const [snapGrnsR, zapGrnsR] = await Promise.all([
    header.source === "zap"
      ? Promise.resolve({ rows: [] })
      : query(
          `SELECT sort_index, grn_id, raw FROM inbound_po_detail_grns WHERE po_id = $1 ORDER BY sort_index`,
          [poId]
        ),
    query(
      `SELECT grn_id, vendor_invoice_number, box_count_invoice, actual_box_count_received,
              grn_sku_count, grn_status, grn_audit_status,
              grn_accepted_quantity, grn_rejected_quantity, grn_shortage_quantity,
              created_by, created_at, updated_at,
              source
         FROM inbound_grns
        WHERE po_id = $1`,
      [poId]
    ),
  ]);

  const grns = mergePoGrnSources(snapGrnsR.rows, zapGrnsR.rows);

  return {
    header,
    snapshot: snap,
    lines,
    grns,
  };
}

type GrnDisplayRow = {
  sort_index: number;
  grn_id: number | null;
  raw: Record<string, unknown>;
};

function rowToTimestamp(raw: Record<string, unknown>): number {
  for (const key of ["updated_at", "updatedAt", "created_at", "createdAt"]) {
    const v = raw[key];
    if (typeof v !== "string" || !v) continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function mergePoGrnSources(
  snapRows: ReadonlyArray<{ sort_index: number; grn_id: number | null; raw: unknown }>,
  zapRows: ReadonlyArray<Record<string, unknown>>
): GrnDisplayRow[] {
  const out: GrnDisplayRow[] = [];
  const seen = new Set<number>();

  for (const r of snapRows) {
    const raw =
      r.raw && typeof r.raw === "object"
        ? (r.raw as Record<string, unknown>)
        : {};
    const id = Number(r.grn_id);
    out.push({
      sort_index: r.sort_index,
      grn_id: Number.isFinite(id) ? id : null,
      raw,
    });
    if (Number.isFinite(id)) seen.add(id);
  }

  let nextIdx = out.length;
  for (const r of zapRows) {
    if (r.grn_id == null) continue;
    const id = Number(r.grn_id);
    if (!Number.isFinite(id) || id === 0 || seen.has(id)) continue;

    /** Authoritative origin marker comes from inbound_grns.source. The
     * legacy negative-id heuristic remains as a fallback for rows that
     * predate migration 060's backfill. Doctrine #3 / #5. */
    const sourceCol = typeof r.source === "string" ? r.source : null;
    let zap_origin: "zap" | "draft" | undefined;
    if (sourceCol === "zap") {
      zap_origin = id < 0 ? "draft" : "zap";
    } else if (sourceCol == null && id < 0) {
      zap_origin = "draft"; // pre-backfill legacy draft
    } // else: eautomate-source row, no marker

    out.push({
      sort_index: nextIdx,
      grn_id: id,
      raw: {
        grn_id: id,
        vendor_invoice_number: r.vendor_invoice_number ?? null,
        box_count_invoice: r.box_count_invoice ?? 0,
        actual_box_count_received: r.actual_box_count_received ?? 0,
        grn_sku_count: r.grn_sku_count ?? 0,
        grn_status: r.grn_status ?? null,
        grn_audit_status: r.grn_audit_status ?? null,
        grn_accepted_quantity: r.grn_accepted_quantity ?? 0,
        grn_rejected_quantity: r.grn_rejected_quantity ?? 0,
        grn_shortage_quantity: r.grn_shortage_quantity ?? 0,
        created_by: r.created_by ?? null,
        created_at: isoOrNull(r.created_at),
        updated_at: isoOrNull(r.updated_at),
        ...(zap_origin ? { zap_origin } : {}),
      },
    });
    nextIdx += 1;
  }

  /** Sort by latest activity timestamp DESC so the most-recent GRN sits at the
   * top regardless of source (snapshot order from eAutomate is preserved as the
   * tiebreaker via sort_index). */
  out.sort((a, b) => {
    const ta = rowToTimestamp(a.raw);
    const tb = rowToTimestamp(b.raw);
    if (ta !== tb) return tb - ta;
    return a.sort_index - b.sort_index;
  });

  return out;
}
